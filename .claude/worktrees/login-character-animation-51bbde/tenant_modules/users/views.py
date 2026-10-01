import json
import traceback
import jwt
from datetime import datetime
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password

from core_system.tenants.models import Tenant
from tenant_modules.centers_and_projects.models import Center
from tenant_modules.students_and_parents.models import Student, Parent as StudentParentModel
from .models import UserProfile, AccountRequest

User = get_user_model()

def parse_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        raise ValueError("صيغة البيانات في الطلب غير صالحة")

def get_tenant_db(request):
    tenant_id = request.headers.get('Tenant-ID')
    if not tenant_id:
        raise ValueError("ترويسة Tenant-ID مفقودة في الطلب")
    
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
        
    return db_name, tenant

def get_token_payload(request):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ')[1]
    try:
        jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
        return jwt.decode(token, jwt_secret, algorithms=["HS256"])
    except Exception:
        return None

def serialize_profile(prof):
    if not prof:
        return {}
    
    enrollments_data = []
    if hasattr(prof, 'enrollments'):
        for en in prof.enrollments.filter(is_active=True).select_related('halaqa__project', 'current_stage', 'current_part'):
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

    return {
        "father_name": prof.father_name,
        "mother_name": prof.mother_name,
        "mother_last_name": prof.mother_last_name,
        "guardian_type": prof.guardian_type or "FATHER",
        "phone": prof.phone,
        "father_phone": prof.father_phone,
        "mother_phone": prof.mother_phone,
        "health_status": prof.health_status,
        "monthly_income": str(prof.monthly_income) if prof.monthly_income is not None else None,
        "orphan_status": prof.orphan_status,
        "latitude": float(prof.latitude) if prof.latitude is not None else None,
        "longitude": float(prof.longitude) if prof.longitude is not None else None,
        "reached_page": prof.reached_page or 1,
        "enrollments": enrollments_data
    }


# ==============================================================================
# Execution Helpers
# ==============================================================================

def check_existing_parent(db_name, guardian_name, guardian_last_name, guardian_type='FATHER'):
    """
    البحث عن ولي أمر نشط يملك نفس (اسم الولي المختار واسم العائلة)
    """
    g_name = guardian_name.strip() if guardian_name else ''
    l_name = guardian_last_name.strip() if guardian_last_name else ''
    if not g_name:
        return None

    parent_profiles = UserProfile.objects.using(db_name).filter(
        role='PARENT',
        is_active=True
    ).select_related('user')

    for prof in parent_profiles:
        u = prof.user
        u_first = u.first_name.strip().lower()
        u_last = u.last_name.strip().lower()
        full_u = f"{u_first} {u_last}".strip()
        full_req = f"{g_name} {l_name}".strip().lower()

        if (u_first == g_name.lower() and u_last == l_name.lower()) or (full_u == full_req):
            return u, prof

    return None


def execute_user_creation(db_name, data):
    """إنشاء حساب مستخدم جديد والتأكد من القواعد والإنشاء التلقائي لولي الأمر"""
    username = data.get('username', '').strip() if data.get('username') else ''
    password = data.get('password', '').strip()
    role = data.get('role', 'STUDENT')
    first_name = data.get('first_name', '').strip()
    last_name = data.get('last_name', '').strip()
    email = data.get('email', '').strip()
    phone = data.get('phone', '').strip()
    father_name = data.get('father_name', '').strip()
    mother_name = data.get('mother_name', '').strip()
    mother_last_name = data.get('mother_last_name', '').strip()
    raw_gt = str(data.get('guardian_type', 'FATHER')).upper().strip()
    guardian_type = raw_gt if raw_gt in ['FATHER', 'MOTHER'] else 'FATHER'
    father_phone = data.get('father_phone', '').strip()
    mother_phone = data.get('mother_phone', '').strip()
    health_status = data.get('health_status', '').strip()
    monthly_income = data.get('monthly_income')
    orphan_status = data.get('orphan_status') # 'm' (أم), 'f' (أب), 't' (اثنان)
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    center_id = data.get('center_id')

    if role == 'STUDENT' and guardian_type == 'MOTHER':
        if not mother_name or not mother_last_name:
            raise ValueError("عذراً، لا يمكن اختيار الأم كولي أمر إلا في حال إدخال اسم الأم وكنيتها")

    # توليد اسم المستخدم تلقائياً في حال عدم تمريره
    if not username:
        if not first_name and not last_name:
            raise ValueError("يجب إدخال اسم المستخدم أو (الاسم الأول والكنية)")
        base_username = f"{first_name}_{last_name}".strip('_').replace(' ', '_')
        username = base_username
        counter = 1
        while User.objects.using(db_name).filter(username=username).exists():
            username = f"{base_username}_{counter}"
            counter += 1

    if not password or not role:
        raise ValueError("كلمة المرور والدور مطلوبان")

    if data.get('username') and User.objects.using(db_name).filter(username=username).exists():
        raise ValueError(f"اسم المستخدم '{username}' مستخدم بالفعل في النظام")

    center = None
    if center_id:
        try:
            center = Center.objects.using(db_name).get(id=center_id)
        except Center.DoesNotExist:
            raise ValueError("المركز المحدد غير موجود")

    # قاعدة مدير المركز الواحد: لا يمكن أن يكون للمركز أكثر من مدير واحد
    if role == 'CENTER_MANAGER' and center:
        if center.manager and center.manager.is_active:
            raise ValueError(f"المركز '{center.name}' يملك مديراً بالفعل ولا يمكن إضافة أكثر من مدير واحد للمركز")

    user = User.objects.using(db_name).create(
        username=username,
        password=make_password(password),
        first_name=first_name,
        last_name=last_name,
        email=email,
        is_active=True
    )

    if role == 'CENTER_MANAGER' and center:
        center.manager = user
        center.save(using=db_name)

    reached_page = data.get('reached_page', 1)

    profile = UserProfile.objects.using(db_name).create(
        user=user,
        role=role,
        center=center,
        father_name=father_name,
        mother_name=mother_name,
        mother_last_name=mother_last_name,
        guardian_type=guardian_type,
        phone=phone,
        father_phone=father_phone,
        mother_phone=mother_phone,
        health_status=health_status,
        monthly_income=monthly_income if monthly_income is not None else None,
        orphan_status=orphan_status if orphan_status in ['m', 'f', 't'] else None,
        latitude=latitude if latitude is not None else None,
        longitude=longitude if longitude is not None else None,
        reached_page=reached_page,
        is_active=True
    )

    parent_profile = None

    # الإنشاء التلقائي أو الربط بحساب ولي الأمر عند إنشاء حساب طالب
    if role == 'STUDENT':
        existing_parent_id = data.get('existing_parent_id')
        parent_user = None

        if existing_parent_id:
            try:
                parent_user = User.objects.using(db_name).get(id=existing_parent_id)
                try:
                    parent_profile = UserProfile.objects.using(db_name).get(user=parent_user)
                except UserProfile.DoesNotExist:
                    parent_profile = None
            except User.DoesNotExist:
                parent_user = None

        # إنشاء ولي أمر جديد إذا لم يُحدّد حساب ولي أمر موجود
        if not parent_user:
            import random
            target_g_name = mother_name if guardian_type == 'MOTHER' else father_name
            target_g_last = (mother_last_name) if guardian_type == 'MOTHER' else last_name
            g_prefix = "mother" if guardian_type == 'MOTHER' else "father"

            base_parent_name = f"{target_g_name}_{target_g_last}".strip('_').replace(' ', '_') if target_g_name else f"{g_prefix}_{username}"
            rand_num = random.randint(100, 999)
            parent_username = f"{base_parent_name}_{rand_num}"

            while User.objects.using(db_name).filter(username=parent_username).exists():
                rand_num += 1
                parent_username = f"{base_parent_name}_{rand_num}"

            if guardian_type == 'MOTHER':
                p_first_name = mother_name if mother_name else f"أم {first_name}"
                p_last_name = mother_last_name if mother_last_name else last_name
                p_phone = mother_phone or phone
            else:
                p_first_name = father_name if father_name else f"ولي أمر {first_name}"
                p_last_name = last_name
                p_phone = father_phone or phone

            parent_user = User.objects.using(db_name).create(
                username=parent_username,
                password=make_password(password),
                first_name=p_first_name,
                last_name=p_last_name,
                email=email,
                is_active=True
            )

            parent_profile = UserProfile.objects.using(db_name).create(
                user=parent_user,
                role='PARENT',
                center=center,
                phone=p_phone,
                father_phone=father_phone,
                mother_phone=mother_phone,
                latitude=latitude,
                longitude=longitude,
                monthly_income=monthly_income,
                is_active=True
            )

        profile.parent_user = parent_user
        profile.save(using=db_name)

        # تزامن السجل أيضاً مع جدولي Student و Parent إن وُجدا
        try:
            sp_parent, _ = StudentParentModel.objects.using(db_name).get_or_create(
                phone=father_phone or phone or '00000000',
                defaults={'full_name': parent_user.first_name, 'email': email}
            )
            st_obj = Student.objects.using(db_name).create(
                full_name=f"{first_name} {last_name}".strip(),
                parent=sp_parent,
                reached_page=reached_page
            )
            
            halaqa_id = data.get('halaqa_id')
            if halaqa_id:
                from tenant_modules.halaqat.models import Halaqa
                from tenant_modules.students_and_parents.models import StudentEnrollment
                from tenant_modules.students_and_parents.utils import resolve_stage_and_part, check_student_project_uniqueness
                try:
                    halaqa = Halaqa.objects.using(db_name).get(id=halaqa_id)
                    is_valid, err_msg = check_student_project_uniqueness(db_name, student=st_obj, user_profile=profile, target_halaqa=halaqa)
                    if not is_valid:
                        user.delete(using=db_name)
                        raise ValueError(err_msg)

                    stage, part = resolve_stage_and_part(db_name, halaqa.project, reached_page)
                    StudentEnrollment.objects.using(db_name).create(
                        student=st_obj,
                        user_profile=profile,
                        halaqa=halaqa,
                        project=halaqa.project,
                        reached_page=reached_page,
                        current_stage=stage,
                        current_part=part,
                        is_active=True
                    )
                    st_obj.halaqa = halaqa
                    st_obj.save(using=db_name)
                except Halaqa.DoesNotExist:
                    pass
        except ValueError as ve:
            raise ve
        except Exception:
            pass


    return user, profile, parent_profile


def execute_user_update(db_name, user, data):
    """تعديل بيانات المستخدم والحماية لحساب manager الافتراضي"""
    if user.username == 'manager':
        raise ValueError("لا يمكن تعديل أو حذف بيانات الأدمن الافتراضي manager")

    try:
        profile = UserProfile.objects.using(db_name).get(user=user)
    except UserProfile.DoesNotExist:
        profile = UserProfile.objects.using(db_name).create(user=user, role='STUDENT')

    if 'first_name' in data:
        user.first_name = data['first_name']
    if 'last_name' in data:
        user.last_name = data['last_name']
    if 'email' in data:
        user.email = data['email']
    if 'password' in data and data['password']:
        user.password = make_password(data['password'])

    user.save(using=db_name)

    if 'phone' in data:
        profile.phone = data['phone']
    if 'father_name' in data:
        profile.father_name = data['father_name']
    if 'mother_name' in data:
        profile.mother_name = data['mother_name']
    if 'mother_last_name' in data:
        profile.mother_last_name = data['mother_last_name']
    if 'guardian_type' in data:
        profile.guardian_type = data['guardian_type']
    if 'father_phone' in data:
        profile.father_phone = data['father_phone']
    if 'mother_phone' in data:
        profile.mother_phone = data['mother_phone']
    if 'health_status' in data:
        profile.health_status = data['health_status']
    if 'monthly_income' in data:
        profile.monthly_income = data['monthly_income']
    if 'orphan_status' in data:
        profile.orphan_status = data['orphan_status']
    if 'latitude' in data:
        profile.latitude = data['latitude']
    if 'longitude' in data:
        profile.longitude = data['longitude']

    if 'center_id' in data:
        if data['center_id']:
            center = Center.objects.using(db_name).get(id=data['center_id'])
            if profile.role == 'CENTER_MANAGER' and center.manager and center.manager != user:
                raise ValueError("لا يمكن إسناد مدير مركز جديد لمركز يملك مديراً بالفعل")
            profile.center = center
            if profile.role == 'CENTER_MANAGER':
                center.manager = user
                center.save(using=db_name)
        else:
            profile.center = None

    profile.save(using=db_name)
    return user, profile


def execute_user_delete(db_name, user):
    """الحذف اللطيف للمستخدم بدون حذف فيزيائي مع حماية manager"""
    if user.username == 'manager':
        raise ValueError("لا يمكن تعديل أو حذف بيانات الأدمن الافتراضي manager")

    user.is_active = False
    user.save(using=db_name)

    try:
        profile = UserProfile.objects.using(db_name).get(user=user)
        profile.is_active = False
        profile.deleted_at = timezone.now()
        profile.save(using=db_name)

        if profile.role == 'CENTER_MANAGER' and profile.center and profile.center.manager == user:
            profile.center.manager = None
            profile.center.save(using=db_name)

        # إلغاء تنشيط حساب الأب تلقائياً إذا كان المستخدم طالب وليس للأب أبناء آخرين نشطين
        if profile.role == 'STUDENT' and profile.parent_user:
            parent_user = profile.parent_user
            has_other_active_children = UserProfile.objects.using(db_name).filter(
                parent_user=parent_user,
                is_active=True
            ).exclude(id=profile.id).exists()

            if not has_other_active_children:
                parent_user.is_active = False
                parent_user.save(using=db_name)

                try:
                    parent_profile = UserProfile.objects.using(db_name).get(user=parent_user)
                    parent_profile.is_active = False
                    parent_profile.deleted_at = timezone.now()
                    parent_profile.save(using=db_name)
                except UserProfile.DoesNotExist:
                    pass
    except UserProfile.DoesNotExist:
        pass

    return True

# ==============================================================================
# API Views
# ==============================================================================

@csrf_exempt
def user_list_create_view(request):
    try:
        db_name, tenant = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    token_payload = get_token_payload(request)
    if not token_payload:
        return JsonResponse({"status": "error", "message": "التوكن مفقود أو غير صالحة"}, status=401)

    requester_role = token_payload.get('role')
    requester_username = token_payload.get('username')

    try:
        requester_user = User.objects.using(db_name).get(username=requester_username)
        requester_profile = UserProfile.objects.using(db_name).get(user=requester_user)
    except Exception:
        requester_profile = None

    if request.method == 'GET':
        try:
            users = User.objects.using(db_name).filter(is_active=True).select_related('profile').order_by('-date_joined')
            res = []
            for u in users:
                prof = getattr(u, 'profile', None)
                item = {
                    "id": str(u.id),
                    "username": u.username,
                    "first_name": u.first_name,
                    "last_name": u.last_name,
                    "email": u.email,
                    "role": prof.role if prof else "UNKNOWN",
                    "center_id": str(prof.center.id) if prof and prof.center else None,
                    "center_name": prof.center.name if prof and prof.center else None,
                    "is_active": u.is_active,
                    "created_at": u.date_joined.isoformat()
                }
                if prof:
                    item.update(serialize_profile(prof))
                res.append(item)
            return JsonResponse({"status": "success", "count": len(res), "data": res}, status=200)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "خطأ عند استرجاع قائمة الحسابات", "details": str(e)}, status=500)

    elif request.method == 'POST':
        try:
            data = parse_body(request)
            target_role = data.get('role', 'STUDENT')
            father_name = data.get('father_name', '')
            mother_name = data.get('mother_name', '')
            mother_last_name = data.get('mother_last_name', '')
            last_name = data.get('last_name', '')
            existing_parent_id = data.get('existing_parent_id')
            create_new_parent = data.get('create_new_parent', False)
            raw_gt = str(data.get('guardian_type', 'FATHER')).upper().strip()
            guardian_type = raw_gt if raw_gt in ['FATHER', 'MOTHER'] else 'FATHER'

            guardian_name = mother_name if guardian_type == 'MOTHER' else father_name
            guardian_last_name = (mother_last_name if mother_last_name else last_name) if guardian_type == 'MOTHER' else last_name
            guardian_title = "الأم" if guardian_type == 'MOTHER' else "الأب"

            # منع اختيار الأم كولي أمر إلا عند أدخال اسم الأم وكنيتها
            if target_role == 'STUDENT' and guardian_type == 'MOTHER':
                if not mother_name.strip() or not mother_last_name.strip():
                    return JsonResponse({
                        "status": "error",
                        "message": "عذراً، لا يمكن اختيار الأم كولي أمر إلا في حال إدخال اسم الأم وكنيتها"
                    }, status=400)

            # التحقق من وجود ولي أمر مطابق عند إنشاء طالب إذا لم يتم تأكيد الاختيار
            if target_role == 'STUDENT' and not existing_parent_id and not create_new_parent:
                existing_p = check_existing_parent(db_name, guardian_name, guardian_last_name, guardian_type)
                if existing_p:
                    ex_user, ex_prof = existing_p
                    return JsonResponse({
                        "status": "warning_parent_exists",
                        "message": f"تنبيه: يوجد ولي أمر مسجل بالفعل باسم '{ex_user.first_name} {ex_user.last_name}' (اسم المستخدم: {ex_user.username}). هل ترغب في ربط هذا الطالب بالحساب الحالي كـ ({guardian_title}) أم إنشاء حساب ولي أمر جديد؟",
                        "requires_parent_confirmation": True,
                        "guardian_type": guardian_type,
                        "existing_parent": {
                            "id": str(ex_user.id),
                            "username": ex_user.username,
                            "full_name": f"{ex_user.first_name} {ex_user.last_name}".strip(),
                            "phone": ex_prof.phone or ex_prof.father_phone or ex_prof.mother_phone or ""
                        }
                    }, status=400)

            # 1. المعلم تقديم طلب فقط دون التنفيذ الفعلي
            if requester_role == 'TEACHER':
                if target_role != 'STUDENT':
                    return JsonResponse({"status": "error", "message": "لا يحق للمعلم تقديم طلب لغير حسابات الطلاب"}, status=403)

                # إضافة ملاحظة التنبيه في بيانات الطلب للظهور للأدمن ومدير المركز
                if existing_parent_id:
                    try:
                        ex_u = User.objects.using(db_name).get(id=existing_parent_id)
                        data['parent_note'] = f"ملاحظة المعلم: قام المعلم باختيار ربط الطالب بولي الأمر الحالي '{ex_u.first_name} {ex_u.last_name}' ({ex_u.username}) كـ ({guardian_title})."
                    except Exception:
                        pass
                elif create_new_parent:
                    data['parent_note'] = f"ملاحظة المعلم: اختار المعلم إنشاء حساب ولي أمر جديد ({guardian_title}) رغم وجود حساب آخر بنفس الاسم."

                center = requester_profile.center if requester_profile else None
                account_req = AccountRequest.objects.using(db_name).create(
                    requested_by=requester_user,
                    center=center,
                    action_type='CREATE',
                    payload=data,
                    status='PENDING'
                )

                return JsonResponse({
                    "status": "pending_approval",
                    "message": "تم تقديم طلب إنشاء حساب الطالب بنجاح، بانتظار موافقة مدير المركز أو الأدمن الرئيسي",
                    "request_id": str(account_req.id)
                }, status=202)

            # 2. مدير المركز يمنع من إنشاء أدمن أو مدير مركز آخر
            if requester_role == 'CENTER_MANAGER':
                if target_role in ['TENANT_ADMIN', 'CENTER_MANAGER']:
                    return JsonResponse({"status": "error", "message": "لا يحق لمدير المركز إنشاء حسابات أدمن رئيسي أو مدراء مراكز آخرين"}, status=403)
                
                if requester_profile and requester_profile.center:
                    data['center_id'] = str(requester_profile.center.id)

            # 3. الأدمن الرئيسي يملك كامل الصلاحية
            if requester_role not in ['TENANT_ADMIN', 'CENTER_MANAGER']:
                return JsonResponse({"status": "error", "message": "صلاحيات الأدمن أو مدير المركز مطلوبة لإنشاء حسابات"}, status=403)

            user, profile, parent_profile = execute_user_creation(db_name, data)

            resp_data = {
                "id": str(user.id),
                "username": user.username,
                "role": profile.role,
                "center_name": profile.center.name if profile.center else None,
                "created_at": user.date_joined.isoformat()
            }
            resp_data.update(serialize_profile(profile))

            if parent_profile:
                resp_data["parent_account"] = {
                    "id": str(parent_profile.user.id),
                    "username": parent_profile.user.username,
                    "role": parent_profile.role
                }

            return JsonResponse({
                "status": "success",
                "message": "تم إنشاء الحساب بنجاح",
                "data": resp_data
            }, status=201)

        except ValueError as e:
            return JsonResponse({"status": "error", "message": str(e)}, status=400)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ غير متوقع أثناء إنشاء الحساب", "details": str(e)}, status=500)
    else:
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def user_detail_view(request, pk):
    try:
        db_name, tenant = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    token_payload = get_token_payload(request)
    if not token_payload:
        return JsonResponse({"status": "error", "message": "التوكن مفقود أو غير صالحة"}, status=401)

    requester_role = token_payload.get('role')
    requester_username = token_payload.get('username')

    try:
        target_user = User.objects.using(db_name).get(id=pk)
        target_profile = UserProfile.objects.using(db_name).get(user=target_user)
    except User.DoesNotExist:
        return JsonResponse({"status": "error", "message": "الحساب المطلوب غير موجود"}, status=404)
    except UserProfile.DoesNotExist:
        target_profile = UserProfile.objects.using(db_name).create(user=target_user, role='STUDENT')

    # حماية manager الافتراضي
    if target_user.username == 'manager' and request.method in ['PUT', 'PATCH', 'DELETE']:
        return JsonResponse({"status": "error", "message": "لا يمكن تعديل أو حذف بيانات الأدمن الافتراضي manager"}, status=403)

    if request.method == 'GET':
        data = {
            "id": str(target_user.id),
            "username": target_user.username,
            "first_name": target_user.first_name,
            "last_name": target_user.last_name,
            "email": target_user.email,
            "role": target_profile.role,
            "center_id": str(target_profile.center.id) if target_profile.center else None,
            "center_name": target_profile.center.name if target_profile.center else None,
            "is_active": target_user.is_active,
            "created_at": target_user.date_joined.isoformat()
        }
        data.update(serialize_profile(target_profile))
        return JsonResponse({"status": "success", "data": data}, status=200)

    elif request.method in ['PUT', 'PATCH']:
        data = parse_body(request)

        if requester_role == 'TEACHER':
            if target_profile.role != 'STUDENT':
                return JsonResponse({"status": "error", "message": "لا يحق للمعلم تعديل غير حسابات الطلاب"}, status=403)

            requester_user = User.objects.using(db_name).get(username=requester_username)
            account_req = AccountRequest.objects.using(db_name).create(
                requested_by=requester_user,
                center=target_profile.center,
                action_type='UPDATE',
                target_user=target_user,
                payload=data,
                status='PENDING'
            )
            return JsonResponse({
                "status": "pending_approval",
                "message": "تم تقديم طلب تعديل حساب الطالب بنجاح، بانتظار موافقة مدير المركز أو الأدمن",
                "request_id": str(account_req.id)
            }, status=202)

        if requester_role == 'CENTER_MANAGER':
            if target_profile.role in ['TENANT_ADMIN', 'CENTER_MANAGER']:
                return JsonResponse({"status": "error", "message": "لا يحق لمدير المركز تعديل حسابات الأدمن الرئيسي أو مدراء المراكز"}, status=403)

        if requester_role not in ['TENANT_ADMIN', 'CENTER_MANAGER']:
            return JsonResponse({"status": "error", "message": "صلاحيات غير كافية لتعديل هذا الحساب"}, status=403)

        try:
            execute_user_update(db_name, target_user, data)
            return JsonResponse({"status": "success", "message": "تم تعديل بيانات الحساب بنجاح"})
        except ValueError as e:
            return JsonResponse({"status": "error", "message": str(e)}, status=400)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل تعديل بيانات الحساب", "details": str(e)}, status=500)

    elif request.method == 'DELETE':
        if requester_role == 'TEACHER':
            if target_profile.role != 'STUDENT':
                return JsonResponse({"status": "error", "message": "لا يحق للمعلم حذف غير حسابات الطلاب"}, status=403)

            requester_user = User.objects.using(db_name).get(username=requester_username)
            account_req = AccountRequest.objects.using(db_name).create(
                requested_by=requester_user,
                center=target_profile.center,
                action_type='DELETE',
                target_user=target_user,
                status='PENDING'
            )
            return JsonResponse({
                "status": "pending_approval",
                "message": "تم تقديم طلب حذف حساب الطالب بنجاح، بانتظار موافقة مدير المركز أو الأدمن",
                "request_id": str(account_req.id)
            }, status=202)

        if requester_role == 'CENTER_MANAGER':
            if target_profile.role in ['TENANT_ADMIN', 'CENTER_MANAGER']:
                return JsonResponse({"status": "error", "message": "لا يحق لمدير المركز حذف حسابات الأدمن الرئيسي أو مدراء المراكز"}, status=403)

        if requester_role not in ['TENANT_ADMIN', 'CENTER_MANAGER']:
            return JsonResponse({"status": "error", "message": "صلاحيات غير كافية لحذف هذا الحساب"}, status=403)

        try:
            execute_user_delete(db_name, target_user)
            return JsonResponse({"status": "success", "message": "تم حذف (إلغاء تنشيط) الحساب بنجاح"})
        except ValueError as e:
            return JsonResponse({"status": "error", "message": str(e)}, status=400)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل حذف الحساب", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def user_impersonate_view(request, pk):
    """
    تسجيل الدخول كأي مستخدم بدون كلمة سر (خاصية الأدمن ومدير المركز للمستهدفين من مركزه)
    """
    if request.method != 'POST':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        db_name, tenant = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    token_payload = get_token_payload(request)
    if not token_payload:
        return JsonResponse({"status": "error", "message": "التوكن مفقودة أو غير صالحة"}, status=401)

    requester_role = token_payload.get('role')
    if requester_role not in ['TENANT_ADMIN', 'CENTER_MANAGER']:
        return JsonResponse({"status": "error", "message": "صلاحيات الأدمن الرئيسي أو مدير المركز مطلوبة لاستخدام الدخول بديل الحساب"}, status=403)

    try:
        target_user = User.objects.using(db_name).get(id=pk)
        target_profile = UserProfile.objects.using(db_name).get(user=target_user)
    except User.DoesNotExist:
        return JsonResponse({"status": "error", "message": "المستخدم المستهدف غير موجود"}, status=404)
    except UserProfile.DoesNotExist:
        target_profile = UserProfile.objects.using(db_name).create(user=target_user, role='STUDENT')

    if requester_role == 'CENTER_MANAGER':
        if target_profile.role in ['TENANT_ADMIN', 'CENTER_MANAGER']:
            return JsonResponse({"status": "error", "message": "لا يحق لمدير المركز الدخول بحساب أدمن أو مدير مركز آخر"}, status=403)

    jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
    access_lifetime = getattr(settings, 'JWT_ACCESS_TOKEN_LIFETIME_MINUTES', 60)
    now = datetime.utcnow()
    payload = {
        "tenant_id": str(tenant.id),
        "subdomain": tenant.subdomain,
        "username": target_user.username,
        "user_id": str(target_user.id),
        "role": target_profile.role,
        "impersonated_by": token_payload.get('username'),
        "exp": now + timezone.timedelta(minutes=int(access_lifetime)),
        "iat": now
    }

    token = jwt.encode(payload, jwt_secret, algorithm="HS256")

    return JsonResponse({
        "status": "success",
        "message": f"تم تسجيل الدخول بنجاح بحساب المستخدم {target_user.username}",
        "data": {
            "access_token": token,
            "token_type": "Bearer",
            "user": {
                "id": str(target_user.id),
                "username": target_user.username,
                "role": target_profile.role
            }
        }
    }, status=200)


@csrf_exempt
def account_request_list_view(request):
    try:
        db_name, tenant = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    token_payload = get_token_payload(request)
    if not token_payload or token_payload.get('role') not in ['TENANT_ADMIN', 'CENTER_MANAGER']:
        return JsonResponse({"status": "error", "message": "صلاحيات الأدمن أو مدير المركز مطلوبة لمشاهدة الطلبات"}, status=403)

    if request.method == 'GET':
        try:
            reqs = AccountRequest.objects.using(db_name).filter(status='PENDING').select_related('requested_by', 'target_user', 'center').order_by('-created_at')
            res = []
            for r in reqs:
                res.append({
                    "id": str(r.id),
                    "requested_by": r.requested_by.username,
                    "center_name": r.center.name if r.center else None,
                    "action_type": r.action_type,
                    "target_username": r.target_user.username if r.target_user else None,
                    "payload": r.payload,
                    "parent_note": r.payload.get('parent_note') if isinstance(r.payload, dict) else None,
                    "status": r.status,
                    "created_at": r.created_at.isoformat()
                })
            return JsonResponse({"status": "success", "count": len(res), "data": res}, status=200)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ أثناء استرجاع قائمة الطلبات", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def account_request_approve_view(request, pk):
    if request.method != 'POST':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        db_name, tenant = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    token_payload = get_token_payload(request)
    if not token_payload or token_payload.get('role') not in ['TENANT_ADMIN', 'CENTER_MANAGER']:
        return JsonResponse({"status": "error", "message": "صلاحيات الأدمن أو مدير المركز مطلوبة للموافقة على الطلبات"}, status=403)

    try:
        acc_req = AccountRequest.objects.using(db_name).get(id=pk, status='PENDING')
    except AccountRequest.DoesNotExist:
        return JsonResponse({"status": "error", "message": "الطلب المعلق غير موجود أو تم اتخاذ إجراء عليه سابقاً"}, status=404)

    reviewer_user = User.objects.using(db_name).get(username=token_payload.get('username'))

    try:
        if acc_req.action_type == 'CREATE':
            user, profile, parent_prof = execute_user_creation(db_name, acc_req.payload)
        elif acc_req.action_type == 'UPDATE':
            user, profile = execute_user_update(db_name, acc_req.target_user, acc_req.payload)
        elif acc_req.action_type == 'DELETE':
            execute_user_delete(db_name, acc_req.target_user)

        acc_req.status = 'APPROVED'
        acc_req.reviewed_by = reviewer_user
        acc_req.save(using=db_name)

        return JsonResponse({"status": "success", "message": "تمت الموافقة على الطلب وتنفيذه بنجاح على قاعدة البيانات"})

    except ValueError as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)
    except Exception as e:
        return JsonResponse({"status": "error", "message": "فشل تنفيذ الطلب", "details": str(e)}, status=500)


@csrf_exempt
def account_request_reject_view(request, pk):
    if request.method != 'POST':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        db_name, tenant = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    token_payload = get_token_payload(request)
    if not token_payload or token_payload.get('role') not in ['TENANT_ADMIN', 'CENTER_MANAGER']:
        return JsonResponse({"status": "error", "message": "صلاحيات الأدمن أو مدير المركز مطلوبة لرفض الطلبات"}, status=403)

    try:
        acc_req = AccountRequest.objects.using(db_name).get(id=pk, status='PENDING')
    except AccountRequest.DoesNotExist:
        return JsonResponse({"status": "error", "message": "الطلب غير موجود أو تم اتخاذ إجراء عليه سابقاً"}, status=404)

    data = parse_body(request)
    reviewer_user = User.objects.using(db_name).get(username=token_payload.get('username'))

    acc_req.status = 'REJECTED'
    acc_req.reviewed_by = reviewer_user
    acc_req.rejection_reason = data.get('reason', 'تم رفض الطلب بواسطة المسؤول')
    acc_req.save(using=db_name)

    return JsonResponse({"status": "success", "message": "تم رفض الطلب بنجاح"})
