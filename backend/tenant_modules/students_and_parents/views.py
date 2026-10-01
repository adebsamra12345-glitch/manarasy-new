import json
import traceback
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from tenant_modules.halaqat.models import Halaqa
from tenant_modules.users.models import UserProfile
from tenant_modules.centers_and_projects.models import Project, ProjectStage, StagePart
from .models import Student, Parent, StudentEnrollment, StudentRegistrationRequest, StudentDeletionRequest
from .utils import resolve_stage_and_part, check_student_project_uniqueness

def parse_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        raise ValueError("صيغة بيانات غير صالحة")

def get_tenant_db(request):
    tenant_id = request.headers.get('Tenant-ID')
    if not tenant_id:
        return 'default'
    try:
        from core_system.tenants.models import Tenant
        tenant = Tenant.objects.using('default').get(id=tenant_id)
        db_name = tenant.db_name
        if db_name not in settings.DATABASES:
            new_db_config = settings.DATABASES['default'].copy()
            new_db_config.update({
                'NAME': tenant.db_name,
                'USER': tenant.db_user or settings.DATABASES['default'].get('USER'),
                'PASSWORD': tenant.db_password_hash or settings.DATABASES['default'].get('PASSWORD'),
                'HOST': tenant.db_host or 'localhost',
                'PORT': tenant.db_port or 5432,
            })
            settings.DATABASES[db_name] = new_db_config
        return db_name
    except Exception:
        return 'default'

@csrf_exempt
def parent_list_create_view(request):
    db_name = get_tenant_db(request)
    
    if request.method == 'GET':
        try:
            parents = Parent.objects.using(db_name).all().order_by('-created_at')
            res = []
            for p in parents:
                res.append({
                    "id": str(p.id),
                    "full_name": p.full_name,
                    "phone": p.phone,
                    "email": p.email,
                    "created_at": p.created_at.isoformat()
                })
            return JsonResponse({"status": "success", "count": len(res), "data": res}, status=200)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ أثناء جلب قائمة أولياء الأمور", "details": str(e)}, status=500)

    elif request.method == 'POST':
        try:
            data = parse_body(request)
            
            if not data.get('full_name') or not data.get('phone'):
                return JsonResponse({"status": "error", "message": "الاسم الكامل ورقم الهاتف مطلوبان"}, status=400)

            parent = Parent.objects.using(db_name).create(
                full_name=data['full_name'],
                phone=data['phone'],
                email=data.get('email')
            )
            return JsonResponse({
                "status": "success",
                "message": "تم إضافة ولي الأمر بنجاح",
                "data": {"id": str(parent.id), "full_name": parent.full_name, "phone": parent.phone}
            }, status=201)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ أثناء إضافة ولي الأمر", "details": str(e)}, status=500)
    else:
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def student_list_create_view(request):
    db_name = get_tenant_db(request)

    if request.method == 'GET':
        halaqa_id = request.GET.get('halaqa_id')
        center_id = request.GET.get('center_id')
        gender = request.GET.get('gender')
        search = request.GET.get('search')
        try:
            queryset = Student.objects.using(db_name).select_related('parent', 'halaqa__center').prefetch_related(
                'enrollments__halaqa__project',
                'enrollments__current_stage',
                'enrollments__current_part'
            ).all().order_by('-created_at')

            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
                try:
                    import jwt
                    jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
                    payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
                    if payload.get('role') == 'TEACHER':
                        user_id = payload.get('user_id')
                        if user_id:
                            prof = UserProfile.objects.using(db_name).get(user__id=user_id)
                            t_name = f"{prof.user.first_name} {prof.user.last_name}".strip() or prof.user.username
                            teacher_halaqat_ids = Halaqa.objects.using(db_name).filter(teacher_name=t_name, is_active=True).values_list('id', flat=True)
                            queryset = queryset.filter(halaqa_id__in=teacher_halaqat_ids)
                    elif payload.get('role') == 'CENTER_MANAGER':
                        user_id = payload.get('user_id')
                        username = payload.get('username')
                        prof = None
                        if user_id:
                            prof = UserProfile.objects.using(db_name).filter(user__id=user_id).first()
                        elif username:
                            prof = UserProfile.objects.using(db_name).filter(user__username=username).first()
                        if prof and prof.center:
                            queryset = queryset.filter(Q(halaqa__center=prof.center) | Q(enrollments__halaqa__center=prof.center)).distinct()
                        else:
                            queryset = queryset.none()
                except Exception:
                    pass

            if halaqa_id and halaqa_id != 'all':
                queryset = queryset.filter(halaqa_id=halaqa_id)
            if center_id and center_id != 'all':
                queryset = queryset.filter(halaqa__center_id=center_id)
            if gender and gender != 'all':
                queryset = queryset.filter(gender=gender)
            if search:
                s_term = search.strip()
                queryset = queryset.filter(full_name__icontains=s_term)
            
            res = []
            for s in queryset:
                enrollments_data = []
                for en in s.enrollments.filter(is_active=True):
                    enrollments_data.append({
                        "enrollment_id": str(en.id),
                        "halaqa_id": str(en.halaqa.id) if en.halaqa else None,
                        "halaqa_name": en.halaqa.name if en.halaqa else None,
                        "project_id": str(en.project.id) if en.project else None,
                        "project_title": en.project.title if en.project else None,
                        "reached_page": en.reached_page,
                        "stage_id": str(en.current_stage.id) if en.current_stage else None,
                        "stage_title": en.current_stage.title if en.current_stage else None,
                        "part_id": str(en.current_part.id) if en.current_part else None,
                        "part_title": en.current_part.title if en.current_part else None,
                    })

                # Calculate Rating
                from django.db.models import Avg
                from datetime import date
                from dateutil.relativedelta import relativedelta
                from .models import EvaluationLog
                
                today = date.today()
                start_date = date(today.year, today.month, 1)
                end_date = start_date + relativedelta(months=1) - relativedelta(days=1)
                
                evaluations = EvaluationLog.objects.using(db_name).filter(
                    student_id=s.id,
                    date__range=(start_date, end_date)
                )
                
                memorization_avg = evaluations.filter(evaluation_type='MEMORIZATION').aggregate(Avg('score'))['score__avg'] or 0.0
                behavior_avg = evaluations.filter(evaluation_type='BEHAVIOR').aggregate(Avg('score'))['score__avg'] or 0.0
                
                real_rating = (float(memorization_avg) + float(behavior_avg)) / 2.0
                if real_rating > 0:
                    real_rating = round((real_rating / 100.0) * 5.0, 1) # convert 0-100 to 0-5 stars

                res.append({
                    "id": str(s.id),
                    "full_name": s.full_name,
                    "national_id": s.national_id,
                    "birth_date": s.birth_date.isoformat() if s.birth_date else None,
                    "gender": s.gender,
                    "parent_id": str(s.parent.id) if s.parent else None,
                    "parent_name": s.parent.full_name if s.parent else None,
                    "parent_phone": s.parent.phone if s.parent else None,
                    "mother_name": s.mother_name,
                    "mother_phone": s.mother_phone,
                    "registration_number": s.registration_number,
                    "current_residence": s.current_residence,
                    "points": s.points,
                    "rating": real_rating,
                    "halaqa_id": str(s.halaqa.id) if s.halaqa else None,
                    "halaqa_name": s.halaqa.name if s.halaqa else None,
                    "center_id": str(s.halaqa.center.id) if (s.halaqa and s.halaqa.center) else None,
                    "center_name": s.halaqa.center.name if (s.halaqa and s.halaqa.center) else None,
                    "is_orphan": bool(s.is_orphan),
                    "has_special_needs": bool(s.has_special_needs),
                    "special_needs_notes": s.special_needs_notes,
                    "income_level": s.income_level,
                    "general_notes": s.general_notes,
                    "reached_page": s.reached_page,
                    "enrollments": enrollments_data,
                    "created_at": s.created_at.isoformat()
                })
            return JsonResponse({"status": "success", "count": len(res), "data": res}, status=200)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ عند استرجاع ملفات الطلاب", "details": str(e)}, status=500)

    elif request.method == 'POST':
        try:
            data = parse_body(request)
            
            if not data.get('full_name'):
                return JsonResponse({"status": "error", "message": "الاسم الكامل للطالب مطلوب"}, status=400)

            reached_page = int(data.get('reached_page') or 1)

            parent = None
            if data.get('parent_id'):
                try:
                    parent = Parent.objects.using(db_name).get(id=data['parent_id'])
                except Parent.DoesNotExist:
                    pass
            elif data.get('parent_name'):
                p_name = data.get('parent_name').strip()
                p_phone = data.get('parent_phone', '').strip()
                parent, _ = Parent.objects.using(db_name).get_or_create(
                    full_name=p_name,
                    defaults={'phone': p_phone}
                )

            halaqa = None
            if data.get('halaqa_id'):
                try:
                    halaqa = Halaqa.objects.using(db_name).get(id=data['halaqa_id'])
                except Halaqa.DoesNotExist:
                    return JsonResponse({"status": "error", "message": "الحلقة القرآنية غير موجودة"}, status=404)

            student = Student.objects.using(db_name).create(
                full_name=data['full_name'].strip(),
                parent=parent,
                halaqa=halaqa,
                gender=data.get('gender') or 'M',
                national_id=data.get('national_id'),
                birth_date=data.get('birth_date') or None,
                mother_name=data.get('mother_name'),
                mother_phone=data.get('mother_phone'),
                registration_number=data.get('registration_number'),
                current_residence=data.get('current_residence'),
                is_orphan=bool(data.get('is_orphan', False)),
                has_special_needs=bool(data.get('has_special_needs', False)),
                special_needs_notes=data.get('special_needs_notes'),
                income_level=data.get('income_level'),
                general_notes=data.get('general_notes'),
                points=int(data.get('points') or 0),
                reached_page=reached_page
            )

            enrollment_info = None
            if halaqa:
                # التحقق من عدم الانضمام لأكثر من حلقة بنفس المشروع
                is_valid, err_msg = check_student_project_uniqueness(db_name, student=student, target_halaqa=halaqa)
                if not is_valid:
                    student.delete(using=db_name)
                    return JsonResponse({"status": "error", "message": err_msg}, status=400)

                # احتساب المرحلة والجزء بناءً على صفحة الوصول والمشروع
                stage, part = resolve_stage_and_part(db_name, halaqa.project, reached_page)

                enrollment = StudentEnrollment.objects.using(db_name).create(
                    student=student,
                    halaqa=halaqa,
                    project=halaqa.project,
                    reached_page=reached_page,
                    current_stage=stage,
                    current_part=part,
                    is_active=True
                )

                enrollment_info = {
                    "enrollment_id": str(enrollment.id),
                    "halaqa_id": str(halaqa.id),
                    "halaqa_name": halaqa.name,
                    "project_id": str(halaqa.project.id) if halaqa.project else None,
                    "project_title": halaqa.project.title if halaqa.project else None,
                    "reached_page": reached_page,
                    "stage_id": str(stage.id) if stage else None,
                    "stage_title": stage.title if stage else None,
                    "part_id": str(part.id) if part else None,
                    "part_title": part.title if part else None
                }

            return JsonResponse({
                "status": "success",
                "message": "تم إنشاء ملف الطالب وتحديد بيانات حفظه بنجاح",
                "data": {
                    "id": str(student.id),
                    "full_name": student.full_name,
                    "reached_page": student.reached_page,
                    "enrollment": enrollment_info
                }
            }, status=201)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ عند إضافة الطالب", "details": str(e)}, status=500)
    else:
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def student_detail_view(request, pk):
    db_name = get_tenant_db(request)
    try:
        student = Student.objects.using(db_name).select_related('parent', 'halaqa__center').get(id=pk)
    except Student.DoesNotExist:
        return JsonResponse({"status": "error", "message": "ملف الطالب غير موجود"}, status=404)

    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        try:
            import jwt
            jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
            payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
            if payload.get('role') == 'CENTER_MANAGER':
                user_id = payload.get('user_id')
                username = payload.get('username')
                prof = None
                if user_id:
                    prof = UserProfile.objects.using(db_name).filter(user__id=user_id).first()
                elif username:
                    prof = UserProfile.objects.using(db_name).filter(user__username=username).first()
                if prof and prof.center:
                    student_center = student.halaqa.center if student.halaqa else None
                    if student_center != prof.center and not student.enrollments.filter(halaqa__center=prof.center).exists():
                        return JsonResponse({"status": "error", "message": "غير مصرح لك بالوصول لبيانات هذا الطالب"}, status=403)
        except Exception:
            pass

    if request.method == 'GET':
        enrollments_data = []
        for en in student.enrollments.filter(is_active=True).select_related('halaqa__project', 'current_stage', 'current_part'):
            enrollments_data.append({
                "enrollment_id": str(en.id),
                "halaqa_id": str(en.halaqa.id) if en.halaqa else None,
                "halaqa_name": en.halaqa.name if en.halaqa else None,
                "project_id": str(en.project.id) if en.project else None,
                "project_title": en.project.title if en.project else None,
                "reached_page": en.reached_page,
                "stage_id": str(en.current_stage.id) if en.current_stage else None,
                "stage_title": en.current_stage.title if en.current_stage else None,
                "part_id": str(en.current_part.id) if en.current_part else None,
                "part_title": en.current_part.title if en.current_part else None,
            })

        data = {
            "id": str(student.id),
            "full_name": student.full_name,
            "national_id": student.national_id,
            "birth_date": student.birth_date.isoformat() if student.birth_date else None,
            "gender": student.gender,
            "parent_id": str(student.parent.id) if student.parent else None,
            "parent_name": student.parent.full_name if student.parent else None,
            "parent_phone": student.parent.phone if student.parent else None,
            "mother_name": student.mother_name,
            "mother_phone": student.mother_phone,
            "registration_number": student.registration_number,
            "current_residence": student.current_residence,
            "points": student.points,
            "rating": student.rating,
            "halaqa_id": str(student.halaqa.id) if student.halaqa else None,
            "halaqa_name": student.halaqa.name if student.halaqa else None,
            "center_id": str(student.halaqa.center.id) if (student.halaqa and student.halaqa.center) else None,
            "center_name": student.halaqa.center.name if (student.halaqa and student.halaqa.center) else None,
            "is_orphan": bool(student.is_orphan),
            "has_special_needs": bool(student.has_special_needs),
            "special_needs_notes": student.special_needs_notes,
            "income_level": student.income_level,
            "general_notes": student.general_notes,
            "reached_page": student.reached_page,
            "enrollments": enrollments_data,
            "created_at": student.created_at.isoformat()
        }
        return JsonResponse({"status": "success", "data": data}, status=200)

    elif request.method in ['PUT', 'PATCH']:
        try:
            data = parse_body(request)

            if 'full_name' in data and data['full_name']:
                student.full_name = data['full_name'].strip()
            if 'gender' in data:
                student.gender = data['gender']
            if 'birth_date' in data:
                student.birth_date = data['birth_date'] or None
            if 'national_id' in data:
                student.national_id = data['national_id']
            if 'registration_number' in data:
                student.registration_number = data['registration_number']
            if 'current_residence' in data:
                student.current_residence = data['current_residence']
            if 'mother_name' in data:
                student.mother_name = data['mother_name']
            if 'mother_phone' in data:
                student.mother_phone = data['mother_phone']
            if 'is_orphan' in data:
                student.is_orphan = bool(data['is_orphan'])
            if 'has_special_needs' in data:
                student.has_special_needs = bool(data['has_special_needs'])
            if 'special_needs_notes' in data:
                student.special_needs_notes = data['special_needs_notes']
            if 'income_level' in data:
                student.income_level = data['income_level']
            if 'general_notes' in data:
                student.general_notes = data['general_notes']
            if 'points' in data:
                student.points = int(data['points'] or 0)
            if 'reached_page' in data and data['reached_page'] is not None:
                student.reached_page = int(data['reached_page'])

            # Parent update
            parent_name = data.get('parent_name')
            parent_phone = data.get('parent_phone')
            if 'parent_id' in data and data['parent_id']:
                try:
                    student.parent = Parent.objects.using(db_name).get(id=data['parent_id'])
                except Parent.DoesNotExist:
                    pass
            elif parent_name:
                if student.parent:
                    student.parent.full_name = parent_name.strip()
                    if parent_phone is not None:
                        student.parent.phone = parent_phone.strip()
                    student.parent.save(using=db_name)
                else:
                    new_parent, _ = Parent.objects.using(db_name).get_or_create(
                        full_name=parent_name.strip(),
                        defaults={'phone': parent_phone or ''}
                    )
                    student.parent = new_parent

            # Halaqa update
            if 'halaqa_id' in data:
                h_id = data['halaqa_id']
                if h_id:
                    try:
                        new_halaqa = Halaqa.objects.using(db_name).get(id=h_id)
                        student.halaqa = new_halaqa
                        # Update or create enrollment
                        stage, part = resolve_stage_and_part(db_name, new_halaqa.project, student.reached_page)
                        StudentEnrollment.objects.using(db_name).update_or_create(
                            student=student,
                            halaqa=new_halaqa,
                            defaults={
                                'project': new_halaqa.project,
                                'reached_page': student.reached_page,
                                'current_stage': stage,
                                'current_part': part,
                                'is_active': True
                            }
                        )
                    except Halaqa.DoesNotExist:
                        pass
                else:
                    student.halaqa = None

            student.save(using=db_name)

            return JsonResponse({
                "status": "success",
                "message": "تم تحديث بيانات الطالب بنجاح",
                "data": {
                    "id": str(student.id),
                    "full_name": student.full_name,
                    "reached_page": student.reached_page
                }
            }, status=200)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ أثناء تعديل بيانات الطالب", "details": str(e)}, status=500)

    elif request.method == 'DELETE':
        try:
            student_name = student.full_name
            student.delete(using=db_name)
            return JsonResponse({
                "status": "success",
                "message": f"تم حذف ملف الطالب '{student_name}' بنجاح"
            }, status=200)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ أثناء حذف الطالب", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def student_registration_request_view(request):
    """
    GET   — يجلب قائمة طلبات التسجيل والتعديل الخاصة بالمعلم أو الإدارة.
    POST  — ينشئ طلب تسجيل طالب جديد (NEW) أو طلب تعديل بيانات طالب (UPDATE).
    """
    db_name = get_tenant_db(request)

    import jwt as _jwt
    from django.conf import settings as _settings

    def _get_requester_profile(req, db):
        auth = req.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return None, JsonResponse({'status': 'error', 'message': 'التوثيق مطلوب'}, status=401)
        token = auth.split(' ', 1)[1]
        try:
            secret = getattr(_settings, 'JWT_SECRET_KEY', _settings.SECRET_KEY)
            payload = _jwt.decode(token, secret, algorithms=['HS256'])
        except Exception:
            return None, JsonResponse({'status': 'error', 'message': 'رمز التوثيق غير صالح أو منتهي الصلاحية'}, status=401)
        user_id = payload.get('user_id')
        if not user_id:
            return None, JsonResponse({'status': 'error', 'message': 'بيانات التوثيق ناقصة'}, status=401)
        try:
            profile = UserProfile.objects.using(db).select_related('user').get(user__id=user_id)
        except UserProfile.DoesNotExist:
            return None, JsonResponse({'status': 'error', 'message': 'الملف الشخصي غير موجود'}, status=404)
        return profile, None

    if request.method == 'GET':
        try:
            profile, err = _get_requester_profile(request, db_name)
            if err:
                return err

            allowed_roles = {'TEACHER', 'TENANT_ADMIN', 'CENTER_MANAGER'}
            if not allowed_roles.intersection(set(profile.get_roles())):
                return JsonResponse({'status': 'error', 'message': 'غير مصرح لك بعرض هذه الطلبات'}, status=403)

            qs = StudentRegistrationRequest.objects.using(db_name).select_related(
                'student', 'requested_by__user', 'halaqa', 'project', 'current_stage', 'current_part'
            ).order_by('-created_at')

            roles = profile.get_roles()
            if 'TEACHER' in roles and 'TENANT_ADMIN' not in roles and 'CENTER_MANAGER' not in roles:
                qs = qs.filter(requested_by=profile)
            elif 'CENTER_MANAGER' in roles and 'TENANT_ADMIN' not in roles:
                if profile.center:
                    qs = qs.filter(halaqa__center=profile.center)
                else:
                    qs = qs.none()

            req_type = request.GET.get('request_type')
            if req_type:
                qs = qs.filter(request_type=req_type)

            status_filter = request.GET.get('status')
            if status_filter:
                qs = qs.filter(status=status_filter)

            data = []
            for req_obj in qs:
                data.append({
                    'id': str(req_obj.id),
                    'request_type': req_obj.request_type,
                    'student_id': str(req_obj.student.id) if req_obj.student else None,
                    'student_name': req_obj.student.full_name if req_obj.student else req_obj.full_name,
                    'full_name': req_obj.full_name,
                    'gender': req_obj.gender,
                    'birth_date': req_obj.birth_date.isoformat() if req_obj.birth_date else None,
                    'national_id': req_obj.national_id,
                    'registration_number': req_obj.registration_number,
                    'is_orphan': req_obj.is_orphan,
                    'has_special_needs': req_obj.has_special_needs,
                    'special_needs_notes': req_obj.special_needs_notes,
                    'parent_name': req_obj.parent_name,
                    'parent_phone': req_obj.parent_phone,
                    'mother_name': req_obj.mother_name,
                    'mother_phone': req_obj.mother_phone,
                    'current_residence': req_obj.current_residence,
                    'income_level': req_obj.income_level,
                    'general_notes': req_obj.general_notes,
                    'halaqa_id': str(req_obj.halaqa.id) if req_obj.halaqa else None,
                    'halaqa_name': req_obj.halaqa.name if req_obj.halaqa else None,
                    'project_id': str(req_obj.project.id) if req_obj.project else None,
                    'project_title': req_obj.project.title if req_obj.project else None,
                    'stage_title': req_obj.current_stage.title if req_obj.current_stage else None,
                    'part_title': req_obj.current_part.title if req_obj.current_part else None,
                    'reached_page': req_obj.reached_page,
                    'requested_by_id': str(req_obj.requested_by.id) if req_obj.requested_by else None,
                    'requested_by_name': (
                        req_obj.requested_by.user.get_full_name() or req_obj.requested_by.user.username
                    ) if req_obj.requested_by else None,
                    'status': req_obj.status,
                    'created_at': req_obj.created_at.isoformat(),
                    'updated_at': req_obj.updated_at.isoformat(),
                })
            return JsonResponse({'status': 'success', 'count': len(data), 'data': data}, status=200)
        except Exception as exc:
            return JsonResponse({'status': 'error', 'message': 'حدث خطأ أثناء جلب الطلبات', 'details': str(exc)}, status=500)

    elif request.method == 'POST':
        try:
            profile, _ = _get_requester_profile(request, db_name)
            data = parse_body(request)
            
            if not data.get('full_name'):
                return JsonResponse({"status": "error", "message": "الاسم الكامل للطالب مطلوب"}, status=400)

            parent_name = data.get('parent_name')
            parent_phone = data.get('parent_phone')
            
            user_profile = profile
            if not user_profile and data.get('user_profile_id'):
                try:
                    user_profile = UserProfile.objects.using(db_name).get(id=data['user_profile_id'])
                except UserProfile.DoesNotExist:
                    pass

            halaqa = None
            if data.get('halaqa_id'):
                try:
                    halaqa = Halaqa.objects.using(db_name).get(id=data['halaqa_id'])
                except Halaqa.DoesNotExist:
                    pass

            project = None
            if data.get('project_id'):
                try:
                    project = Project.objects.using(db_name).get(id=data['project_id'])
                except Project.DoesNotExist:
                    pass

            current_stage = None
            if data.get('stage_id'):
                try:
                    current_stage = ProjectStage.objects.using(db_name).get(id=data['stage_id'])
                except ProjectStage.DoesNotExist:
                    pass

            current_part = None
            if data.get('part_id'):
                try:
                    current_part = StagePart.objects.using(db_name).get(id=data['part_id'])
                except StagePart.DoesNotExist:
                    pass

            request_type = data.get('request_type', 'NEW')
            student = None
            if request_type == 'UPDATE' and data.get('student_id'):
                try:
                    student = Student.objects.using(db_name).get(id=data['student_id'])
                except Student.DoesNotExist:
                    return JsonResponse({"status": "error", "message": "الطالب المحدد غير موجود"}, status=404)

            reg_request = StudentRegistrationRequest.objects.using(db_name).create(
                request_type=request_type,
                student=student,
                requested_by=user_profile,
                halaqa=halaqa,
                full_name=data['full_name'],
                gender=data.get('gender') or 'M',
                birth_date=data.get('birth_date') or None,
                national_id=data.get('national_id'),
                registration_number=data.get('registration_number'),
                is_orphan=data.get('is_orphan', False),
                has_special_needs=data.get('has_special_needs', False),
                special_needs_notes=data.get('special_needs_notes'),
                parent_name=parent_name,
                parent_phone=parent_phone,
                mother_name=data.get('mother_name'),
                mother_phone=data.get('mother_phone'),
                current_residence=data.get('current_residence'),
                income_level=data.get('income_level'),
                general_notes=data.get('general_notes'),
                project=project,
                current_stage=current_stage,
                current_part=current_part,
                reached_page=int(data.get('reached_page') or 1),
                status='PENDING'
            )

            return JsonResponse({
                "status": "success",
                "message": "تم إرسال الطلب بنجاح وهو قيد المراجعة",
                "data": {
                    "id": str(reg_request.id),
                    "status": reg_request.status
                }
            }, status=201)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ أثناء إرسال طلب التسجيل", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def cancel_student_registration_request_view(request, request_id):
    """
    إلغاء/التراجع عن طلب التسجيل/التعديل بواسطة المعلم.
    يشترط أن تكون حالة الطلب (PENDING أو UNDER_REVIEW).
    """
    if request.method not in ('POST', 'PATCH'):
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    db_name = get_tenant_db(request)
    import jwt as _jwt
    from django.conf import settings as _settings

    def _get_requester_profile(req, db):
        auth = req.headers.get('Authorization') or req.META.get('HTTP_AUTHORIZATION', '')
        if not auth.startswith('Bearer '):
            return None, JsonResponse({'status': 'error', 'message': 'التوثيق مطلوب'}, status=401)
        token = auth.split(' ', 1)[1]
        try:
            secret = getattr(_settings, 'JWT_SECRET_KEY', _settings.SECRET_KEY)
            payload = _jwt.decode(token, secret, algorithms=['HS256'])
        except Exception:
            return None, JsonResponse({'status': 'error', 'message': 'رمز التوثيق غير صالح أو منتهي الصلاحية'}, status=401)
        user_id = payload.get('user_id')
        if not user_id:
            return None, JsonResponse({'status': 'error', 'message': 'بيانات التوثيق ناقصة'}, status=401)
        try:
            profile = UserProfile.objects.using(db).select_related('user').get(user__id=user_id)
        except UserProfile.DoesNotExist:
            return None, JsonResponse({'status': 'error', 'message': 'الملف الشخصي غير موجود'}, status=404)
        return profile, None

    profile, err = _get_requester_profile(request, db_name)
    if err:
        return err

    try:
        reg_req = StudentRegistrationRequest.objects.using(db_name).get(id=request_id)
    except StudentRegistrationRequest.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'الطلب المحدد غير موجود'}, status=404)

    roles = profile.get_roles()
    if 'TEACHER' in roles and 'TENANT_ADMIN' not in roles and 'CENTER_MANAGER' not in roles:
        if reg_req.requested_by != profile:
            return JsonResponse({'status': 'error', 'message': 'غير مصرح لك بإلغاء هذا الطلب'}, status=403)

    if reg_req.status not in ('PENDING', 'UNDER_REVIEW'):
        return JsonResponse({
            'status': 'error',
            'message': 'لا يمكن التراجع عن الطلب في حالته الحالية (موافق عليه، مرفوض، أو ملغى)'
        }, status=400)

    reg_req.status = 'CANCELLED'
    reg_req.save(using=db_name)

    return JsonResponse({
        'status': 'success',
        'message': 'تم التراجع عن الطلب بنجاح وتغيير حالته إلى: ملغى بواسطة المعلم',
        'data': {
            'id': str(reg_req.id),
            'status': 'CANCELLED'
        }
    }, status=200)


@csrf_exempt
def cancel_student_deletion_request_view(request, request_id):
    """
    إلغاء/التراجع عن طلب حذف طالب بواسطة المعلم.
    يشترط أن تكون حالة الطلب (PENDING أو UNDER_REVIEW).
    """
    if request.method not in ('POST', 'PATCH'):
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    db_name = get_tenant_db(request)
    import jwt as _jwt
    from django.conf import settings as _settings

    def _get_requester_profile(req, db):
        auth = req.headers.get('Authorization') or req.META.get('HTTP_AUTHORIZATION', '')
        if not auth.startswith('Bearer '):
            return None, JsonResponse({'status': 'error', 'message': 'التوثيق مطلوب'}, status=401)
        token = auth.split(' ', 1)[1]
        try:
            secret = getattr(_settings, 'JWT_SECRET_KEY', _settings.SECRET_KEY)
            payload = _jwt.decode(token, secret, algorithms=['HS256'])
        except Exception:
            return None, JsonResponse({'status': 'error', 'message': 'رمز التوثيق غير صالح أو منتهي الصلاحية'}, status=401)
        user_id = payload.get('user_id')
        if not user_id:
            return None, JsonResponse({'status': 'error', 'message': 'بيانات التوثيق ناقصة'}, status=401)
        try:
            profile = UserProfile.objects.using(db).select_related('user').get(user__id=user_id)
        except UserProfile.DoesNotExist:
            return None, JsonResponse({'status': 'error', 'message': 'الملف الشخصي غير موجود'}, status=404)
        return profile, None

    profile, err = _get_requester_profile(request, db_name)
    if err:
        return err

    try:
        del_req = StudentDeletionRequest.objects.using(db_name).get(id=request_id)
    except StudentDeletionRequest.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'الطلب المحدد غير موجود'}, status=404)

    roles = profile.get_roles()
    if 'TEACHER' in roles and 'TENANT_ADMIN' not in roles and 'CENTER_MANAGER' not in roles:
        if del_req.requested_by != profile:
            return JsonResponse({'status': 'error', 'message': 'غير مصرح لك بإلغاء هذا الطلب'}, status=403)

    if del_req.status not in ('PENDING', 'UNDER_REVIEW'):
        return JsonResponse({
            'status': 'error',
            'message': 'لا يمكن التراجع عن الطلب في حالته الحالية (موافق عليه، مرفوض، أو ملغى)'
        }, status=400)

    del_req.status = 'CANCELLED'
    del_req.save(using=db_name)

    return JsonResponse({
        'status': 'success',
        'message': 'تم التراجع عن الطلب بنجاح وتغيير حالته إلى: ملغى بواسطة المعلم',
        'data': {
            'id': str(del_req.id),
            'status': 'CANCELLED'
        }
    }, status=200)

    try:
        del_req = StudentDeletionRequest.objects.using(db_name).get(id=request_id)
    except StudentDeletionRequest.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'الطلب المحدد غير موجود'}, status=404)

    # التحقق من أن المستخدم هو من أنشأ الطلب أو مدير
    roles = profile.get_roles()
    if 'TEACHER' in roles and 'TENANT_ADMIN' not in roles and 'CENTER_MANAGER' not in roles:
        if del_req.requested_by != profile:
            return JsonResponse({'status': 'error', 'message': 'غير مصرح لك بإلغاء هذا الطلب'}, status=403)

    # شروط التراجع: PENDING أو UNDER_REVIEW فقط
    if del_req.status not in ('PENDING', 'UNDER_REVIEW'):
        return JsonResponse({
            'status': 'error',
            'message': 'لا يمكن التراجع عن الطلب في حالته الحالية (موافق عليه، مرفوض، أو ملغى)'
        }, status=400)

    del_req.status = 'CANCELLED'
    del_req.save(using=db_name)

    return JsonResponse({
        'status': 'success',
        'message': 'تم التراجع عن الطلب بنجاح وتغيير حالته إلى: ملغى بواسطة المعلم',
        'data': {
            'id': str(del_req.id),
            'status': 'CANCELLED'
        }
    }, status=200)



@csrf_exempt
def student_enrollment_view(request):
    """
    إسناد الطالب إلى حلقة قرآنية وتحديد/تحديث معلومات الحفظ (صفحة الوصول والمشروع والمرحلة والجزء)
    في عملية منفصلة
    """
    if request.method != 'POST':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        db_name = get_tenant_db(request)
        data = parse_body(request)

        student_id = data.get('student_id')
        user_profile_id = data.get('user_profile_id')
        halaqa_id = data.get('halaqa_id')
        reached_page = data.get('reached_page')

        if not halaqa_id or (not student_id and not user_profile_id):
            return JsonResponse({"status": "error", "message": "معرف الطالب (student_id / user_profile_id) ومعرف الحلقة (halaqa_id) مطلوبان"}, status=400)

        student = None
        user_profile = None

        if student_id:
            try:
                student = Student.objects.using(db_name).get(id=student_id)
            except Student.DoesNotExist:
                return JsonResponse({"status": "error", "message": "ملف الطالب غير موجود"}, status=404)

        if user_profile_id:
            try:
                user_profile = UserProfile.objects.using(db_name).get(id=user_profile_id)
            except UserProfile.DoesNotExist:
                return JsonResponse({"status": "error", "message": "حساب المستفيد (UserProfile) غير موجود"}, status=404)

        try:
            halaqa = Halaqa.objects.using(db_name).get(id=halaqa_id)
        except Halaqa.DoesNotExist:
            return JsonResponse({"status": "error", "message": "الحلقة القرآنية غير موجودة"}, status=404)

        # التحقق من شرط عدم الانضمام لأكثر من حلقة بنفس المشروع
        is_valid, err_msg = check_student_project_uniqueness(
            db_name,
            student=student,
            user_profile=user_profile,
            target_halaqa=halaqa
        )
        if not is_valid:
            return JsonResponse({"status": "error", "message": err_msg}, status=400)

        # تحديد صفحة الوصول
        target_page = reached_page
        if target_page is None:
            if student and student.reached_page:
                target_page = student.reached_page
            elif user_profile and user_profile.reached_page:
                target_page = user_profile.reached_page
            else:
                target_page = 1

        target_page = int(target_page)

        # تحديث صفحة الوصول والحلقة بالملف الأساسي
        if student:
            student.reached_page = target_page
            student.halaqa = halaqa
            student.save(using=db_name)

        if user_profile:
            user_profile.reached_page = target_page
            user_profile.save(using=db_name)

        # تحديث/احتساب المرحلة والجزء للمشروع
        stage, part = resolve_stage_and_part(db_name, halaqa.project, target_page)

        enrollment, created = StudentEnrollment.objects.using(db_name).update_or_create(
            student=student,
            user_profile=user_profile,
            halaqa=halaqa,
            defaults={
                'project': halaqa.project,
                'reached_page': target_page,
                'current_stage': stage,
                'current_part': part,
                'is_active': True
            }
        )

        action_str = "تم ضم الطالب بنجاح للحلقة وتحديد مرحلته وجزئه" if created else "تم تحديث معلومات التسجيل والحفظ للطالب بنجاح"
        return JsonResponse({
            "status": "success",
            "message": action_str,
            "data": {
                "enrollment_id": str(enrollment.id),
                "student_id": str(student.id) if student else None,
                "user_profile_id": str(user_profile.id) if user_profile else None,
                "halaqa_id": str(halaqa.id),
                "halaqa_name": halaqa.name,
                "project_id": str(halaqa.project.id) if halaqa.project else None,
                "project_title": halaqa.project.title if halaqa.project else None,
                "reached_page": target_page,
                "stage_id": str(stage.id) if stage else None,
                "stage_title": stage.title if stage else None,
                "part_id": str(part.id) if part else None,
                "part_title": part.title if part else None
            }
        }, status=201 if created else 200)

    except Exception as e:
        return JsonResponse({"status": "error", "message": "حدث خطأ أثناء تسجيل الطالب في الحلقة", "details": str(e)}, status=500)

from django.db.models import Avg
from datetime import date
from dateutil.relativedelta import relativedelta
from .models import EvaluationLog

@csrf_exempt
def student_evaluation_summary_view(request, student_id):
    if request.method != 'GET':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)
    
    db_name = get_tenant_db(request)
    try:
        month_str = request.GET.get('month')
        year_str = request.GET.get('year')
        
        if not month_str or not year_str:
            today = date.today()
            target_date = today
        else:
            target_date = date(int(year_str), int(month_str), 1)
        
        start_date = date(target_date.year, target_date.month, 1)
        end_date = start_date + relativedelta(months=1) - relativedelta(days=1)
        
        evaluations = EvaluationLog.objects.using(db_name).filter(
            student_id=student_id,
            date__range=(start_date, end_date)
        )
        
        memorization_avg = evaluations.filter(evaluation_type='MEMORIZATION').aggregate(Avg('score'))['score__avg']
        behavior_avg = evaluations.filter(evaluation_type='BEHAVIOR').aggregate(Avg('score'))['score__avg']
        
        memorization_avg = float(memorization_avg) if memorization_avg else 0.0
        behavior_avg = float(behavior_avg) if behavior_avg else 0.0
        
        final_score = (memorization_avg + behavior_avg) / 2.0
        
        return JsonResponse({
            "status": "success",
            "data": {
                "memorization_avg": memorization_avg,
                "behavior_avg": behavior_avg,
                "final_score": final_score
            }
        }, status=200)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)

@csrf_exempt
def record_evaluation_view(request):
    if request.method != 'POST':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)
    
    db_name = get_tenant_db(request)
    try:
        data = parse_body(request)
        student_id = data.get('student_id')
        evaluation_type = data.get('evaluation_type')
        score = data.get('score')
        date_str = data.get('date', str(date.today()))
        
        if not all([student_id, evaluation_type, score]):
            return JsonResponse({"status": "error", "message": "Missing required fields"}, status=400)
            
        student = Student.objects.using(db_name).get(id=student_id)
        
        log = EvaluationLog.objects.using(db_name).create(
            student=student,
            evaluation_type=evaluation_type,
            score=score,
            date=date_str,
            notes=data.get('notes', '')
        )
        
        return JsonResponse({"status": "success", "message": "Evaluation recorded successfully", "data": {"id": str(log.id)}}, status=201)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=500)


@csrf_exempt
def student_deletion_request_view(request):
    """
    POST  — ينشئ طلب حذف طالب (للمعلمين فقط).
    GET   — يجلب قائمة طلبات الحذف (للإدارة أو المعلم نفسه).
    """
    db_name = get_tenant_db(request)

    import jwt as _jwt
    from django.conf import settings as _settings

    def _get_requester_profile(req, db):
        auth = req.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return None, JsonResponse({'status': 'error', 'message': 'التوثيق مطلوب'}, status=401)
        token = auth.split(' ', 1)[1]
        try:
            secret = getattr(_settings, 'JWT_SECRET_KEY', _settings.SECRET_KEY)
            payload = _jwt.decode(token, secret, algorithms=['HS256'])
        except Exception:
            return None, JsonResponse({'status': 'error', 'message': 'رمز التوثيق غير صالح أو منتهي الصلاحية'}, status=401)
        user_id = payload.get('user_id')
        if not user_id:
            return None, JsonResponse({'status': 'error', 'message': 'بيانات التوثيق ناقصة'}, status=401)
        try:
            profile = UserProfile.objects.using(db).select_related('user').get(user__id=user_id)
        except UserProfile.DoesNotExist:
            return None, JsonResponse({'status': 'error', 'message': 'الملف الشخصي غير موجود'}, status=404)
        return profile, None

    # ── GET: جلب القائمة ──────────────────────────────────────────────────────
    if request.method == 'GET':
        try:
            profile, err = _get_requester_profile(request, db_name)
            if err:
                return err

            allowed_roles = {'TEACHER', 'TENANT_ADMIN', 'CENTER_MANAGER'}
            if not allowed_roles.intersection(set(profile.get_roles())):
                return JsonResponse({'status': 'error', 'message': 'غير مصرح لك بعرض طلبات الحذف'}, status=403)

            qs = StudentDeletionRequest.objects.using(db_name).select_related(
                'student', 'requested_by__user', 'reviewed_by__user'
            ).order_by('-created_at')

            # المعلم يرى طلباته فقط، ومدير المركز يرى طلبات مركزه فقط
            roles = profile.get_roles()
            if 'TEACHER' in roles and 'TENANT_ADMIN' not in roles and 'CENTER_MANAGER' not in roles:
                qs = qs.filter(requested_by=profile)
            elif 'CENTER_MANAGER' in roles and 'TENANT_ADMIN' not in roles:
                if profile.center:
                    qs = qs.filter(Q(student__halaqa__center=profile.center) | Q(student__enrollments__halaqa__center=profile.center)).distinct()
                else:
                    qs = qs.none()

            status_filter = request.GET.get('status')
            if status_filter:
                qs = qs.filter(status=status_filter)

            data = []
            for dr in qs:
                data.append({
                    'id': str(dr.id),
                    'student_id': str(dr.student.id),
                    'student_name': dr.student.full_name,
                    'requested_by_id': str(dr.requested_by.id) if dr.requested_by else None,
                    'requested_by_name': (
                        dr.requested_by.user.get_full_name() or dr.requested_by.user.username
                    ) if dr.requested_by else None,
                    'reason': dr.reason,
                    'status': dr.status,
                    'reviewed_by_name': (
                        dr.reviewed_by.user.get_full_name() or dr.reviewed_by.user.username
                    ) if dr.reviewed_by else None,
                    'rejection_reason': dr.rejection_reason,
                    'created_at': dr.created_at.isoformat(),
                    'updated_at': dr.updated_at.isoformat(),
                })
            return JsonResponse({'status': 'success', 'count': len(data), 'data': data}, status=200)

        except Exception as exc:
            return JsonResponse({'status': 'error', 'message': 'حدث خطأ أثناء جلب طلبات الحذف', 'details': str(exc)}, status=500)

    # ── POST: إنشاء طلب جديد ──────────────────────────────────────────────────
    elif request.method == 'POST':
        try:
            profile, err = _get_requester_profile(request, db_name)
            if err:
                return err

            # صلاحية المعلم فقط
            if 'TEACHER' not in profile.get_roles():
                return JsonResponse({'status': 'error', 'message': 'هذه العملية متاحة للمعلمين فقط'}, status=403)

            data = parse_body(request)
            student_id = data.get('student_id')
            reason = (data.get('reason') or '').strip()

            if not student_id:
                return JsonResponse({'status': 'error', 'message': 'معرف الطالب مطلوب'}, status=400)

            try:
                student = Student.objects.using(db_name).get(id=student_id)
            except Student.DoesNotExist:
                return JsonResponse({'status': 'error', 'message': 'الطالب المحدد غير موجود'}, status=404)

            # منع إرسال طلب مكرر بحالة PENDING
            already_pending = StudentDeletionRequest.objects.using(db_name).filter(
                student=student, status='PENDING'
            ).exists()
            if already_pending:
                return JsonResponse(
                    {'status': 'error', 'message': 'يوجد طلب حذف قيد الانتظار لهذا الطالب بالفعل'},
                    status=409
                )

            dr = StudentDeletionRequest.objects.using(db_name).create(
                student=student,
                requested_by=profile,
                reason=reason or None,
                status='PENDING'
            )

            return JsonResponse({
                'status': 'success',
                'message': f"تم إرسال طلب حذف الطالب '{student.full_name}' بنجاح وهو قيد مراجعة الإدارة",
                'data': {
                    'id': str(dr.id),
                    'student_id': str(student.id),
                    'student_name': student.full_name,
                    'status': dr.status,
                    'created_at': dr.created_at.isoformat()
                }
            }, status=201)

        except ValueError as ve:
            return JsonResponse({'status': 'error', 'message': str(ve)}, status=400)
        except Exception as exc:
            return JsonResponse({'status': 'error', 'message': 'حدث خطأ أثناء إرسال طلب الحذف', 'details': str(exc)}, status=500)

    return JsonResponse({'status': 'error', 'message': 'Method not allowed'}, status=405)

