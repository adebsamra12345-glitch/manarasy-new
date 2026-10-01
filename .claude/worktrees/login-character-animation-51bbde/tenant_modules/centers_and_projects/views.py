import json
import traceback
import jwt
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.db import IntegrityError
from core_system.tenants.models import Tenant
from .models import (
    Center, Project, ProjectStage, StagePart, 
    ExamTemplate, ExamQuestion, StudentExamResult, SystemNotification,
    EvaluationTemplate, EvaluationGrade
)

def parse_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        raise ValueError("صيغة بيانات غير صالحة")

def is_tenant_admin(request):
    """دالة مساعدة للتحقق من صلاحيات الإدمن من خلال توكن JWT"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return False
    token = auth_header.split(' ')[1]
    try:
        jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
        payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
        return payload.get('role') == 'TENANT_ADMIN'
    except Exception:
        return False

def is_admin_or_center_manager(request):
    """دالة مساعدة للتحقق من صلاحيات الإدمن الرئيسي أو مدير المركز"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return False
    token = auth_header.split(' ')[1]
    try:
        jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
        payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
        role = payload.get('role')
        return role in ['TENANT_ADMIN', 'CENTER_MANAGER']
    except Exception:
        return False

def get_tenant_db(request):
    """استخراج اسم قاعدة بيانات المسجد وتجهيز الاتصال بها ديناميكياً"""
    tenant_id = request.headers.get('Tenant-ID')
    if not tenant_id:
        raise ValueError("ترويسة Tenant-ID مفقودة في الطلب")
    
    tenant = Tenant.objects.using('default').get(id=tenant_id)
    db_name = tenant.db_name
    
    if db_name not in settings.DATABASES:
        new_db_config = settings.DATABASES['default'].copy()
        new_db_config.update({
            'NAME': tenant.db_name,
            'USER': tenant.db_user,
            'PASSWORD': tenant.db_password_hash,
            'HOST': tenant.db_host,
            'PORT': tenant.db_port,
        })
        settings.DATABASES[db_name] = new_db_config
        
    return db_name


# قائمة الأجزاء القرآنية الـ 30 الافتراضية بنطاق صفحاتها القياسي
QURAN_JUZ_PRESETS = [
    {"juz": 1, "title": "الجزء 1", "start_page": 1, "end_page": 21},
    {"juz": 2, "title": "الجزء 2", "start_page": 22, "end_page": 41},
    {"juz": 3, "title": "الجزء 3", "start_page": 42, "end_page": 61},
    {"juz": 4, "title": "الجزء 4", "start_page": 62, "end_page": 81},
    {"juz": 5, "title": "الجزء 5", "start_page": 82, "end_page": 101},
    {"juz": 6, "title": "الجزء 6", "start_page": 102, "end_page": 121},
    {"juz": 7, "title": "الجزء 7", "start_page": 122, "end_page": 141},
    {"juz": 8, "title": "الجزء 8", "start_page": 142, "end_page": 161},
    {"juz": 9, "title": "الجزء 9", "start_page": 162, "end_page": 181},
    {"juz": 10, "title": "الجزء 10", "start_page": 182, "end_page": 201},
    {"juz": 11, "title": "الجزء 11", "start_page": 202, "end_page": 221},
    {"juz": 12, "title": "الجزء 12", "start_page": 222, "end_page": 241},
    {"juz": 13, "title": "الجزء 13", "start_page": 242, "end_page": 261},
    {"juz": 14, "title": "الجزء 14", "start_page": 262, "end_page": 281},
    {"juz": 15, "title": "الجزء 15", "start_page": 282, "end_page": 301},
    {"juz": 16, "title": "الجزء 16", "start_page": 302, "end_page": 321},
    {"juz": 17, "title": "الجزء 17", "start_page": 322, "end_page": 341},
    {"juz": 18, "title": "الجزء 18", "start_page": 342, "end_page": 361},
    {"juz": 19, "title": "الجزء 19", "start_page": 362, "end_page": 381},
    {"juz": 20, "title": "الجزء 20", "start_page": 382, "end_page": 401},
    {"juz": 21, "title": "الجزء 21", "start_page": 402, "end_page": 421},
    {"juz": 22, "title": "الجزء 22", "start_page": 422, "end_page": 441},
    {"juz": 23, "title": "الجزء 23", "start_page": 442, "end_page": 461},
    {"juz": 24, "title": "الجزء 24", "start_page": 462, "end_page": 481},
    {"juz": 25, "title": "الجزء 25", "start_page": 482, "end_page": 501},
    {"juz": 26, "title": "الجزء 26", "start_page": 502, "end_page": 521},
    {"juz": 27, "title": "الجزء 27", "start_page": 522, "end_page": 541},
    {"juz": 28, "title": "الجزء 28", "start_page": 542, "end_page": 561},
    {"juz": 29, "title": "الجزء 29", "start_page": 562, "end_page": 581},
    {"juz": 30, "title": "الجزء 30", "start_page": 582, "end_page": 604},
]

@csrf_exempt
def quran_juz_presets_view(request):
    """إرجاع القائمة الجاهزة لأجزاء القرآن 1-30 ونطاقات صفحاتها القياسية"""
    return JsonResponse({
        "status": "success",
        "count": len(QURAN_JUZ_PRESETS),
        "data": QURAN_JUZ_PRESETS
    }, status=200)


@csrf_exempt
def center_list_create_view(request):
    try:
        db_name = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    if request.method == 'GET':
        try:
            centers = Center.objects.using(db_name).all().order_by('-created_at')
            res = [{"id": str(c.id), "name": c.name, "code": c.code, "address": c.address} for c in centers]
            return JsonResponse({"status": "success", "count": len(res), "data": res}, status=200)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ عند استرجاع المراكز", "details": str(e)}, status=500)

    elif request.method == 'POST':
        if not is_tenant_admin(request):
            return JsonResponse({"status": "error", "message": "صلاحيات مدير النظام مطلوبة لإنشاء مركز جديد"}, status=403)
        try:
            data = parse_body(request)
            if not data.get('name') or not data.get('code'):
                return JsonResponse({"status": "error", "message": "الاسم والكود مطلوبان"}, status=400)

            center = Center.objects.using(db_name).create(
                name=data['name'],
                code=data['code'],
                address=data.get('address')
            )
            return JsonResponse({
                "status": "success",
                "message": "تم إضافة المركز بنجاح",
                "data": {"id": str(center.id), "name": center.name, "code": center.code}
            }, status=201)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل إنشاء المركز", "details": str(e)}, status=500)
    else:
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def center_detail_view(request, pk):
    try:
        db_name = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    try:
        center = Center.objects.using(db_name).get(id=pk)
    except Center.DoesNotExist:
        return JsonResponse({"status": "error", "message": "المركز غير موجود"}, status=404)

    if request.method == 'GET':
        return JsonResponse({
            "status": "success",
            "data": {
                "id": str(center.id),
                "name": center.name,
                "code": center.code,
                "address": center.address,
                "latitude": float(center.latitude) if center.latitude is not None else None,
                "longitude": float(center.longitude) if center.longitude is not None else None,
                "is_active": center.is_active,
                "created_at": center.created_at.isoformat()
            }
        }, status=200)

    elif request.method == 'PUT':
        if not is_tenant_admin(request):
            return JsonResponse({"status": "error", "message": "صلاحيات مدير النظام مطلوبة لتعديل بيانات المركز"}, status=403)
        try:
            data = parse_body(request)
            center.name = data.get('name', center.name)
            center.code = data.get('code', center.code)
            center.address = data.get('address', center.address)
            center.save(using=db_name)
            return JsonResponse({"status": "success", "message": "تم تعديل بيانات المركز بنجاح"})
        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل تعديل بيانات المركز", "details": str(e)}, status=500)

    elif request.method == 'DELETE':
        if not is_tenant_admin(request):
            return JsonResponse({"status": "error", "message": "صلاحيات مدير النظام مطلوبة لحذف المركز"}, status=403)
        try:
            center.delete(using=db_name)
            return JsonResponse({"status": "success", "message": "تم حذف المركز بنجاح"})
        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل حذف المركز", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


def check_project_permission(request, db_name, is_global=False, center_ids=None, project=None):
    """التحقق من صلاحيات الإدمن أو مدير المركز للمشاريع"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return False
    token = auth_header.split(' ')[1]
    
    try:
        jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
        payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
        role = payload.get('role')
        username = payload.get('username')
        user_id = payload.get('user_id')

        if role == 'TENANT_ADMIN':
            return True

        if role in ['TEACHER', 'PARENT']:
            return False

        if role != 'CENTER_MANAGER':
            return False

        if is_global:
            return False

        if center_ids:
            for cid in center_ids:
                try:
                    c = Center.objects.using(db_name).get(id=cid)
                    if not c.manager or (c.manager.username != username and (not user_id or str(c.manager.id) != str(user_id))):
                        return False
                except Center.DoesNotExist:
                    return False

        if project and not center_ids:
            user_manages = False
            for c in project.centers.all():
                if c.manager and (c.manager.username == username or (user_id and str(c.manager.id) == str(user_id))):
                    user_manages = True
                    break
            if not user_manages:
                return False

        return True
    except Exception:
        return False


def serialize_stage(stage):
    parts = stage.parts.all()
    return {
        "id": str(stage.id),
        "title": stage.title,
        "description": stage.description,
        "order": stage.order,
        "has_exam": stage.has_exam,
        "exam_template_id": str(stage.exam_template.id) if stage.exam_template else None,
        "exam_template_title": stage.exam_template.title if stage.exam_template else None,
        "created_at": stage.created_at.isoformat() if stage.created_at else None,
        "parts": [
            {
                "id": str(p.id),
                "title": p.title,
                "part_type": p.part_type,
                "juz_number": p.juz_number,
                "start_page": p.start_page,
                "end_page": p.end_page,
                "order": p.order,
                "created_at": p.created_at.isoformat() if p.created_at else None
            } for p in parts
        ]
    }


def serialize_project(project):
    stages = project.stages.prefetch_related('parts', 'exam_template').all()
    eval_tmpl = project.evaluation_template
    eval_tmpl_data = None
    if eval_tmpl:
        grades = eval_tmpl.grades.all().order_by('order', 'id')
        eval_tmpl_data = {
            "id": str(eval_tmpl.id),
            "title": eval_tmpl.title,
            "description": eval_tmpl.description,
            "grades": [
                {
                    "id": str(g.id),
                    "name": g.name,
                    "requires_repeat": g.requires_repeat,
                    "order": g.order,
                    "color_code": g.color_code
                } for g in grades
            ]
        }

    return {
        "id": str(project.id),
        "title": project.title,
        "description": project.description,
        "project_type": project.project_type,
        "is_global": project.is_global,
        "require_exam_for_all_stages": project.require_exam_for_all_stages,
        "evaluation_template_id": str(eval_tmpl.id) if eval_tmpl else None,
        "evaluation_template_title": eval_tmpl.title if eval_tmpl else None,
        "evaluation_template": eval_tmpl_data,
        "is_active": project.is_active,
        "centers": [{"id": str(c.id), "name": c.name} for c in project.centers.all()],
        "stages": [serialize_stage(s) for s in stages],
        "created_at": project.created_at.isoformat() if project.created_at else None
    }


def validate_and_get_exam_template(db_name, has_exam, exam_template_id):
    """
    التحقق من صحة اختيار نموذج الامتحان عند تفعيل الامتحان للمرحلة أو المشروع
    """
    if not has_exam and not exam_template_id:
        return None, None

    if exam_template_id:
        try:
            tmpl = ExamTemplate.objects.using(db_name).get(id=exam_template_id, is_active=True)
            return tmpl, None
        except ExamTemplate.DoesNotExist:
            return None, "عذراً، نموذج الامتحان المحدد غير موجود في المنصة. يرجى اختيار نموذج امتحان موجود."

    if has_exam and not exam_template_id:
        any_exists = ExamTemplate.objects.using(db_name).filter(is_active=True).exists()
        if not any_exists:
            return None, "عذراً، لا يوجد أي نموذج امتحان مضاف في المنصة بعد. يرجى إضافة نموذج امتحان أولاً من قسم الامتحانات قبل تفعيل امتحان المرحلة."
        else:
            return None, "عذراً، يجب اختيار وتحديد نموذج امتحان موجود في المنصة عند تفعيل امتحان المرحلة."

    return None, None


def create_stages_and_parts_for_project(db_name, project, stages_data):
    """إنشاء المراكز والأجزاء المتسلسلة والمرافقة للمشروع"""
    for s_idx, st_data in enumerate(stages_data, 1):
        st_title = st_data.get('title', f"المرحلة {s_idx}").strip()
        st_desc = st_data.get('description', '')
        st_order = st_data.get('order', s_idx)
        has_exam = st_data.get('has_exam', False) or project.require_exam_for_all_stages
        exam_template_id = st_data.get('exam_template_id')
        
        exam_template, err_msg = validate_and_get_exam_template(db_name, has_exam, exam_template_id)
        if err_msg:
            raise ValueError(err_msg)

        stage = ProjectStage.objects.using(db_name).create(
            project=project,
            title=st_title,
            description=st_desc,
            order=st_order,
            has_exam=has_exam,
            exam_template=exam_template
        )


        parts_data = st_data.get('parts', [])
        for p_idx, pt_data in enumerate(parts_data, 1):
            pt_title = pt_data.get('title', f"الجزء {p_idx}").strip()
            pt_type = pt_data.get('part_type', 'DEFAULT_QURAN')
            juz_num = pt_data.get('juz_number')
            pt_order = pt_data.get('order', p_idx)

            start_page = pt_data.get('start_page', 1)
            end_page = pt_data.get('end_page', 1)

            if pt_type == 'DEFAULT_QURAN' and juz_num and 1 <= int(juz_num) <= 30:
                preset = QURAN_JUZ_PRESETS[int(juz_num) - 1]
                if 'start_page' not in pt_data:
                    start_page = preset['start_page']
                if 'end_page' not in pt_data:
                    end_page = preset['end_page']

            StagePart.objects.using(db_name).create(
                stage=stage,
                title=pt_title,
                part_type=pt_type,
                juz_number=juz_num,
                start_page=start_page,
                end_page=end_page,
                order=pt_order
            )


@csrf_exempt
def project_list_create_view(request):
    try:
        db_name = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    if request.method == 'GET':
        try:
            projects = Project.objects.using(db_name).prefetch_related('centers', 'stages__parts', 'stages__exam_template', 'evaluation_template__grades').all().order_by('-created_at')
            res = [serialize_project(p) for p in projects]
            return JsonResponse({"status": "success", "count": len(res), "data": res}, status=200)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "خطأ عند استرجاع المشاريع", "details": str(e)}, status=500)

    elif request.method == 'POST':
        try:
            data = parse_body(request)
            title = data.get('title')
            project_type = data.get('project_type', 'QURAN')
            is_global = data.get('is_global', False)
            require_exam_for_all_stages = data.get('require_exam_for_all_stages', False)
            evaluation_template_id = data.get('evaluation_template_id')
            center_ids = data.get('center_ids', [])
            confirm_duplicate = data.get('confirm_duplicate', False)
            stages_data = data.get('stages', [])
            
            if not title:
                return JsonResponse({"status": "error", "message": "عنوان المشروع مطلوب"}, status=400)

            if not is_global and not center_ids:
                return JsonResponse({"status": "error", "message": "يجب تحديد مراكز للمشروع أو جعله عاماً لكل المراكز"}, status=400)

            if not check_project_permission(request, db_name, is_global=is_global, center_ids=center_ids):
                return JsonResponse({"status": "error", "message": "عذراً، صلاحيات الإدمن أو مدير المركز مطلوبة لإنشاء مشروع."}, status=403)

            clean_title = title.strip()
            existing_projects = Project.objects.using(db_name).filter(title__iexact=clean_title)

            if existing_projects.exists():
                auth_header = request.headers.get('Authorization', '')
                user_role = None
                if auth_header.startswith('Bearer '):
                    token = auth_header.split(' ')[1]
                    try:
                        jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
                        payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
                        user_role = payload.get('role')
                    except Exception:
                        pass

                if user_role == 'CENTER_MANAGER':
                    in_other_centers = False
                    for ep in existing_projects:
                        if ep.is_global:
                            in_other_centers = True
                            break
                        ep_center_ids = set(str(cid) for cid in ep.centers.values_list('id', flat=True))
                        req_center_ids = set(str(cid) for cid in center_ids)
                        if not ep_center_ids.issubset(req_center_ids) or not ep_center_ids:
                            in_other_centers = True
                            break
                    
                    if in_other_centers:
                        return JsonResponse({
                            "status": "error",
                            "message": "هذا المشروع موجود في مراكز أخرى، لذا يرجى التواصل مع الادمن الرئيسي"
                        }, status=400)

                if not confirm_duplicate:
                    return JsonResponse({
                        "status": "warning_duplicate",
                        "message": "يوجد مشروع سابق بنفس الاسم، هل تريد متابعة الإنشاء أم لا؟",
                        "requires_confirmation": True
                    }, status=400)

            if not evaluation_template_id:
                return JsonResponse({"status": "error", "message": "عذراً، يجب تحديد نموذج تقييم مضاف مسبقاً في النظام لربطه بالمشروع عند الإنشاء"}, status=400)

            try:
                eval_template = EvaluationTemplate.objects.using(db_name).get(id=evaluation_template_id, is_active=True)
            except EvaluationTemplate.DoesNotExist:
                return JsonResponse({"status": "error", "message": "نموذج التقييم المحدد غير موجود أو غير نشط"}, status=404)

            if require_exam_for_all_stages:
                any_exists = ExamTemplate.objects.using(db_name).filter(is_active=True).exists()
                if not any_exists:
                    return JsonResponse({
                        "status": "error",
                        "message": "عذراً، لا يوجد أي نموذج امتحان مضاف في المنصة بعد. يرجى إضافة نموذج امتحان أولاً من قسم الامتحانات قبل تفعيل امتحان المرحلة."
                    }, status=400)

            project = Project.objects.using(db_name).create(
                title=clean_title,
                description=data.get('description'),
                project_type=project_type,
                is_global=is_global,
                require_exam_for_all_stages=require_exam_for_all_stages,
                evaluation_template=eval_template
            )
            
            if not is_global and center_ids:
                centers = Center.objects.using(db_name).filter(id__in=center_ids)
                project.centers.set(centers)

            if stages_data:
                try:
                    create_stages_and_parts_for_project(db_name, project, stages_data)
                except ValueError as ve:
                    project.delete(using=db_name)
                    return JsonResponse({"status": "error", "message": str(ve)}, status=400)

            return JsonResponse({
                "status": "success",
                "message": "تم إنشاء المشروع بنجاح مع مراحله وأجزائه",
                "data": serialize_project(project)
            }, status=201)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ عند حفظ المشروع", "details": str(e)}, status=500)
    else:
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def project_detail_view(request, pk):
    try:
        db_name = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    try:
        project = Project.objects.using(db_name).prefetch_related('centers', 'stages__parts', 'stages__exam_template', 'evaluation_template__grades').get(id=pk)
    except Project.DoesNotExist:
        return JsonResponse({"status": "error", "message": "المشروع المطلوب غير موجود"}, status=404)

    if request.method == 'GET':
        return JsonResponse({
            "status": "success",
            "data": serialize_project(project)
        }, status=200)

    elif request.method == 'PUT':
        try:
            data = parse_body(request)
            is_global = data.get('is_global', project.is_global)
            center_ids = data.get('center_ids', None)

            if not check_project_permission(request, db_name, is_global=is_global, center_ids=center_ids, project=project):
                return JsonResponse({"status": "error", "message": "عذراً، صلاحيات الإدمن أو مدير المركز مطلوبة لتعديل المشروع."}, status=403)

            project.title = data.get('title', project.title)
            project.description = data.get('description', project.description)
            project.project_type = data.get('project_type', project.project_type)
            project.is_global = is_global
            if 'require_exam_for_all_stages' in data:
                req_exam = data['require_exam_for_all_stages']
                if req_exam:
                    any_exists = ExamTemplate.objects.using(db_name).filter(is_active=True).exists()
                    if not any_exists:
                        return JsonResponse({
                            "status": "error",
                            "message": "عذراً، لا يوجد أي نموذج امتحان مضاف في المنصة بعد. يرجى إضافة نموذج امتحان أولاً من قسم الامتحانات قبل تفعيل امتحان المرحلة."
                        }, status=400)
                    for st in project.stages.all():
                        if not st.exam_template:
                            return JsonResponse({
                                "status": "error",
                                "message": "عذراً، يجب اختيار وتحديد نموذج امتحان موجود في المنصة عند تفعيل امتحان المرحلة."
                            }, status=400)
                project.require_exam_for_all_stages = req_exam

            if 'evaluation_template_id' in data:
                eval_tmpl_id = data['evaluation_template_id']
                if not eval_tmpl_id:
                    return JsonResponse({"status": "error", "message": "عذراً، يجب أن يكون المشروع مرتبطاً بنموذج تقييم مضاف مسبقاً ولا يمكن إلغاء تحديده"}, status=400)
                try:
                    project.evaluation_template = EvaluationTemplate.objects.using(db_name).get(id=eval_tmpl_id, is_active=True)
                except EvaluationTemplate.DoesNotExist:
                    return JsonResponse({"status": "error", "message": "نموذج التقييم المحدد غير موجود أو غير نشط"}, status=404)


            project.save(using=db_name)
            
            if center_ids is not None and not is_global:
                centers = Center.objects.using(db_name).filter(id__in=center_ids)
                project.centers.set(centers)
            elif is_global:
                project.centers.clear()

            return JsonResponse({"status": "success", "message": "تم تعديل بيانات المشروع بنجاح", "data": serialize_project(project)})
        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل تعديل المشروع", "details": str(e)}, status=500)

    elif request.method == 'PATCH':
        try:
            data = parse_body(request)
            if not check_project_permission(request, db_name, project=project):
                return JsonResponse({"status": "error", "message": "عذراً، صلاحيات الإدمن أو مدير المركز مطلوبة لتغيير حالة المشروع."}, status=403)

            if 'is_active' in data:
                project.is_active = data['is_active']
                project.save(using=db_name)
                state = "تفعيل" if project.is_active else "إنهاء"
                return JsonResponse({"status": "success", "message": f"تم {state} المشروع بنجاح"})
            return JsonResponse({"status": "error", "message": "يجب تمرير حالة is_active"}, status=400)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل تغيير حالة المشروع", "details": str(e)}, status=500)

    elif request.method == 'DELETE':
        if not check_project_permission(request, db_name, project=project):
            return JsonResponse({"status": "error", "message": "عذراً، صلاحيات الإدمن أو مدير المركز مطلوبة لحذف المشروع."}, status=403)

        try:
            project.delete(using=db_name)
            return JsonResponse({"status": "success", "message": "تم حذف المشروع نهائياً بنجاح"})
        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل حذف المشروع", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def stage_list_create_view(request, project_id):
    try:
        db_name = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    try:
        project = Project.objects.using(db_name).get(id=project_id)
    except Project.DoesNotExist:
        return JsonResponse({"status": "error", "message": "المشروع المحدد غير موجود"}, status=404)

    if request.method == 'GET':
        stages = project.stages.using(db_name).prefetch_related('parts', 'exam_template').all()
        return JsonResponse({"status": "success", "data": [serialize_stage(s) for s in stages]}, status=200)

    elif request.method == 'POST':
        if not check_project_permission(request, db_name, project=project):
            return JsonResponse({"status": "error", "message": "صلاحيات غير كافية لإضافة مرحلة بهذا المشروع"}, status=403)

        try:
            data = parse_body(request)
            title = data.get('title')
            if not title:
                return JsonResponse({"status": "error", "message": "عنوان المرحلة مطلوب"}, status=400)

            has_exam = data.get('has_exam', False) or project.require_exam_for_all_stages
            exam_template_id = data.get('exam_template_id')
            
            exam_template, err_msg = validate_and_get_exam_template(db_name, has_exam, exam_template_id)
            if err_msg:
                return JsonResponse({"status": "error", "message": err_msg}, status=400)

            stage = ProjectStage.objects.using(db_name).create(
                project=project,
                title=title.strip(),
                description=data.get('description'),
                order=data.get('order', project.stages.count() + 1),
                has_exam=has_exam,
                exam_template=exam_template
            )

            parts_data = data.get('parts', [])
            if parts_data:
                for p_idx, pt_data in enumerate(parts_data, 1):
                    pt_title = pt_data.get('title', f"الجزء {p_idx}").strip()
                    pt_type = pt_data.get('part_type', 'DEFAULT_QURAN')
                    juz_num = pt_data.get('juz_number')
                    pt_order = pt_data.get('order', p_idx)
                    start_page = pt_data.get('start_page', 1)
                    end_page = pt_data.get('end_page', 1)

                    if pt_type == 'DEFAULT_QURAN' and juz_num and 1 <= int(juz_num) <= 30:
                        preset = QURAN_JUZ_PRESETS[int(juz_num) - 1]
                        if 'start_page' not in pt_data:
                            start_page = preset['start_page']
                        if 'end_page' not in pt_data:
                            end_page = preset['end_page']

                    StagePart.objects.using(db_name).create(
                        stage=stage,
                        title=pt_title,
                        part_type=pt_type,
                        juz_number=juz_num,
                        start_page=start_page,
                        end_page=end_page,
                        order=pt_order
                    )

            return JsonResponse({"status": "success", "message": "تم إضافة المرحلة بنجاح", "data": serialize_stage(stage)}, status=201)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل إضافة المرحلة", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def stage_detail_view(request, stage_id):
    try:
        db_name = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    try:
        stage = ProjectStage.objects.using(db_name).prefetch_related('parts', 'exam_template').get(id=stage_id)
    except ProjectStage.DoesNotExist:
        return JsonResponse({"status": "error", "message": "المرحلة المطلوبة غير موجودة"}, status=404)

    if not check_project_permission(request, db_name, project=stage.project):
        return JsonResponse({"status": "error", "message": "صلاحيات غير كافية لتعديل/حذف هذه المرحلة"}, status=403)

    if request.method == 'PUT':
        try:
            data = parse_body(request)
            stage.title = data.get('title', stage.title).strip()
            stage.description = data.get('description', stage.description)
            stage.order = data.get('order', stage.order)
            has_exam = data.get('has_exam', stage.has_exam) if 'has_exam' in data else stage.has_exam
            if stage.project.require_exam_for_all_stages:
                has_exam = True

            if 'exam_template_id' in data:
                exam_template_id = data['exam_template_id']
            else:
                exam_template_id = str(stage.exam_template.id) if stage.exam_template else None

            exam_template, err_msg = validate_and_get_exam_template(db_name, has_exam, exam_template_id)
            if err_msg:
                return JsonResponse({"status": "error", "message": err_msg}, status=400)

            stage.has_exam = has_exam
            stage.exam_template = exam_template
            stage.save(using=db_name)
            return JsonResponse({"status": "success", "message": "تم تعديل المرحلة بنجاح", "data": serialize_stage(stage)})
        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل تعديل المرحلة", "details": str(e)}, status=500)

    elif request.method == 'DELETE':
        try:
            stage.delete(using=db_name)
            return JsonResponse({"status": "success", "message": "تم حذف المرحلة بنجاح"})
        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل حذف المرحلة", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def part_list_create_view(request, stage_id):
    try:
        db_name = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    try:
        stage = ProjectStage.objects.using(db_name).get(id=stage_id)
    except ProjectStage.DoesNotExist:
        return JsonResponse({"status": "error", "message": "المرحلة المطلوبة غير موجودة"}, status=404)

    if not check_project_permission(request, db_name, project=stage.project):
        return JsonResponse({"status": "error", "message": "صلاحيات غير كافية لإضافة جزء في هذه المرحلة"}, status=403)

    if request.method == 'POST':
        try:
            data = parse_body(request)
            pt_title = data.get('title')
            pt_type = data.get('part_type', 'DEFAULT_QURAN')
            juz_num = data.get('juz_number')
            start_page = data.get('start_page', 1)
            end_page = data.get('end_page', 1)
            pt_order = data.get('order', stage.parts.count() + 1)

            if not pt_title:
                return JsonResponse({"status": "error", "message": "عنوان الجزء مطلوب"}, status=400)

            if pt_type == 'DEFAULT_QURAN' and juz_num and 1 <= int(juz_num) <= 30:
                preset = QURAN_JUZ_PRESETS[int(juz_num) - 1]
                if 'start_page' not in data:
                    start_page = preset['start_page']
                if 'end_page' not in data:
                    end_page = preset['end_page']

            part = StagePart.objects.using(db_name).create(
                stage=stage,
                title=pt_title.strip(),
                part_type=pt_type,
                juz_number=juz_num,
                start_page=start_page,
                end_page=end_page,
                order=pt_order
            )

            return JsonResponse({
                "status": "success",
                "message": "تم إضافة الجزء بنجاح",
                "data": {
                    "id": str(part.id),
                    "title": part.title,
                    "part_type": part.part_type,
                    "juz_number": part.juz_number,
                    "start_page": part.start_page,
                    "end_page": part.end_page,
                    "order": part.order
                }
            }, status=201)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل إضافة الجزء", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def part_detail_view(request, part_id):
    try:
        db_name = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    try:
        part = StagePart.objects.using(db_name).select_related('stage__project').get(id=part_id)
    except StagePart.DoesNotExist:
        return JsonResponse({"status": "error", "message": "الجزء المطلوب غير موجود"}, status=404)

    if not check_project_permission(request, db_name, project=part.stage.project):
        return JsonResponse({"status": "error", "message": "صلاحيات غير كافية لتعديل/حذف هذا الجزء"}, status=403)

    if request.method == 'PUT':
        try:
            data = parse_body(request)
            part.title = data.get('title', part.title).strip()
            part.part_type = data.get('part_type', part.part_type)
            part.juz_number = data.get('juz_number', part.juz_number)
            part.start_page = data.get('start_page', part.start_page)
            part.end_page = data.get('end_page', part.end_page)
            part.order = data.get('order', part.order)
            part.save(using=db_name)
            return JsonResponse({"status": "success", "message": "تم تعديل بيانات الجزء بنجاح"})
        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل تعديل الجزء", "details": str(e)}, status=500)

    elif request.method == 'DELETE':
        try:
            part.delete(using=db_name)
            return JsonResponse({"status": "success", "message": "تم حذف الجزء بنجاح"})
        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل حذف الجزء", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


# ==============================================================================
# Evaluation Templates API (نماذج التقييم وفئات التسميع)
# ==============================================================================

def serialize_evaluation_grade(g):
    return {
        "id": str(g.id),
        "name": g.name,
        "requires_repeat": g.requires_repeat,
        "order": g.order,
        "color_code": g.color_code
    }

def serialize_evaluation_template(tmpl):
    grades = tmpl.grades.all().order_by('order', 'id')
    projects = tmpl.projects.all()
    return {
        "id": str(tmpl.id),
        "title": tmpl.title,
        "description": tmpl.description,
        "is_active": tmpl.is_active,
        "grades": [serialize_evaluation_grade(g) for g in grades],
        "assigned_projects": [{"id": str(p.id), "title": p.title} for p in projects],
        "created_at": tmpl.created_at.isoformat() if tmpl.created_at else None,
        "updated_at": tmpl.updated_at.isoformat() if tmpl.updated_at else None
    }


@csrf_exempt
def evaluation_template_list_create_view(request):
    try:
        db_name = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    if request.method == 'GET':
        try:
            templates = EvaluationTemplate.objects.using(db_name).filter(is_active=True).prefetch_related('grades', 'projects').order_by('-created_at')
            res = [serialize_evaluation_template(t) for t in templates]
            return JsonResponse({"status": "success", "count": len(res), "data": res}, status=200)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ أثناء جلب نماذج التقييم", "details": str(e)}, status=500)

    elif request.method == 'POST':
        if not is_admin_or_center_manager(request):
            return JsonResponse({"status": "error", "message": "عذراً، صلاحيات الإدمن أو مدير المركز مطلوبة لإنشاء نموذج تقييم."}, status=403)
        try:
            data = parse_body(request)
            title = data.get('title')
            if not title:
                return JsonResponse({"status": "error", "message": "عنوان نموذج التقييم مطلوب"}, status=400)

            tmpl = EvaluationTemplate.objects.using(db_name).create(
                title=title.strip(),
                description=data.get('description'),
                is_active=True
            )

            grades_data = data.get('grades', [])
            for idx, g_data in enumerate(grades_data, 1):
                g_name = g_data.get('name', '').strip()
                if not g_name:
                    continue
                req_repeat = g_data.get('requires_repeat', False)
                order = g_data.get('order', idx)
                color = g_data.get('color_code')

                EvaluationGrade.objects.using(db_name).create(
                    template=tmpl,
                    name=g_name,
                    requires_repeat=req_repeat,
                    order=order,
                    color_code=color
                )

            project_ids = data.get('project_ids', [])
            if project_ids:
                Project.objects.using(db_name).filter(id__in=project_ids).update(evaluation_template=tmpl)

            return JsonResponse({
                "status": "success",
                "message": "تم إنشاء نموذج التقييم بنجاح وربطه بالمشاريع المحددة",
                "data": serialize_evaluation_template(tmpl)
            }, status=201)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل إنشاء نموذج التقييم", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def evaluation_template_detail_view(request, pk):
    try:
        db_name = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    try:
        tmpl = EvaluationTemplate.objects.using(db_name).prefetch_related('grades', 'projects').get(id=pk)
    except EvaluationTemplate.DoesNotExist:
        return JsonResponse({"status": "error", "message": "نموذج التقييم غير موجود"}, status=404)

    if request.method == 'GET':
        return JsonResponse({
            "status": "success",
            "data": serialize_evaluation_template(tmpl)
        }, status=200)

    elif request.method == 'PUT':
        if not is_admin_or_center_manager(request):
            return JsonResponse({"status": "error", "message": "عذراً، صلاحيات الإدمن أو مدير المركز مطلوبة لتعديل نموذج التقييم."}, status=403)
        try:
            data = parse_body(request)
            tmpl.title = data.get('title', tmpl.title).strip()
            tmpl.description = data.get('description', tmpl.description)
            if 'is_active' in data:
                tmpl.is_active = data['is_active']
            tmpl.save(using=db_name)

            if 'grades' in data:
                tmpl.grades.all().delete()
                grades_data = data['grades']
                for idx, g_data in enumerate(grades_data, 1):
                    g_name = g_data.get('name', '').strip()
                    if not g_name:
                        continue
                    req_repeat = g_data.get('requires_repeat', False)
                    order = g_data.get('order', idx)
                    color = g_data.get('color_code')

                    EvaluationGrade.objects.using(db_name).create(
                        template=tmpl,
                        name=g_name,
                        requires_repeat=req_repeat,
                        order=order,
                        color_code=color
                    )

            if 'project_ids' in data:
                Project.objects.using(db_name).filter(evaluation_template=tmpl).update(evaluation_template=None)
                project_ids = data['project_ids']
                if project_ids:
                    Project.objects.using(db_name).filter(id__in=project_ids).update(evaluation_template=tmpl)

            return JsonResponse({
                "status": "success",
                "message": "تم تعديل نموذج التقييم والمشاريع المرتبطة بنجاح",
                "data": serialize_evaluation_template(tmpl)
            }, status=200)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل تعديل نموذج التقييم", "details": str(e)}, status=500)

    elif request.method == 'DELETE':
        if not is_admin_or_center_manager(request):
            return JsonResponse({"status": "error", "message": "عذراً، صلاحيات الإدمن أو مدير المركز مطلوبة لحذف نموذج التقييم."}, status=403)
        try:
            tmpl.is_active = False
            tmpl.save(using=db_name)
            return JsonResponse({"status": "success", "message": "تم إلغاء تنشيط (حذف) نموذج التقييم بنجاح"})
        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل حذف نموذج التقييم", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


# ==============================================================================
# Exam Templates API (نماذج الامتحانات والأسئلة)
# ==============================================================================

def serialize_exam_question(q):
    return {
        "id": str(q.id),
        "question_text": q.question_text,
        "question_type": q.question_type,
        "options": q.options,
        "correct_answer": q.correct_answer,
        "points": float(q.points),
        "order": q.order
    }

def serialize_exam_template(tmpl):
    questions = tmpl.questions.all().order_by('order', 'id')
    return {
        "id": str(tmpl.id),
        "title": tmpl.title,
        "description": tmpl.description,
        "pass_score": float(tmpl.pass_score),
        "total_score": float(tmpl.total_score),
        "is_active": tmpl.is_active,
        "questions_count": questions.count(),
        "questions": [serialize_exam_question(q) for q in questions],
        "created_at": tmpl.created_at.isoformat() if tmpl.created_at else None,
        "updated_at": tmpl.updated_at.isoformat() if tmpl.updated_at else None
    }


@csrf_exempt
def exam_template_list_create_view(request):
    try:
        db_name = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    if request.method == 'GET':
        try:
            templates = ExamTemplate.objects.using(db_name).filter(is_active=True).prefetch_related('questions').order_by('-created_at')
            res = [serialize_exam_template(t) for t in templates]
            return JsonResponse({"status": "success", "count": len(res), "data": res}, status=200)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ عند استرجاع نماذج الامتحانات", "details": str(e)}, status=500)

    elif request.method == 'POST':
        if not is_admin_or_center_manager(request):
            return JsonResponse({"status": "error", "message": "عذراً، صلاحيات الإدمن أو مدير المركز مطلوبة لإنشاء نموذج امتحان."}, status=403)
        try:
            data = parse_body(request)
            title = data.get('title')
            if not title:
                return JsonResponse({"status": "error", "message": "عنوان نموذج الامتحان مطلوب"}, status=400)

            pass_score = data.get('pass_score', 50.00)
            total_score = data.get('total_score', 100.00)

            tmpl = ExamTemplate.objects.using(db_name).create(
                title=title.strip(),
                description=data.get('description'),
                pass_score=pass_score,
                total_score=total_score,
                is_active=True
            )

            questions_data = data.get('questions', [])
            for idx, q_data in enumerate(questions_data, 1):
                q_text = q_data.get('question_text', '').strip()
                if not q_text:
                    continue
                q_type = q_data.get('question_type', 'MULTIPLE_CHOICE')
                options = q_data.get('options', [])
                correct_ans = q_data.get('correct_answer', '')
                points = q_data.get('points', 10.00)
                order = q_data.get('order', idx)

                ExamQuestion.objects.using(db_name).create(
                    template=tmpl,
                    question_text=q_text,
                    question_type=q_type,
                    options=options,
                    correct_answer=correct_ans,
                    points=points,
                    order=order
                )

            return JsonResponse({
                "status": "success",
                "message": "تم إضافة نموذج الامتحان بنجاح",
                "data": serialize_exam_template(tmpl)
            }, status=201)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل إضافة نموذج الامتحان", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def exam_template_detail_view(request, pk):
    try:
        db_name = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    try:
        tmpl = ExamTemplate.objects.using(db_name).prefetch_related('questions').get(id=pk)
    except ExamTemplate.DoesNotExist:
        return JsonResponse({"status": "error", "message": "نموذج الامتحان المطلوب غير موجود"}, status=404)

    if request.method == 'GET':
        return JsonResponse({
            "status": "success",
            "data": serialize_exam_template(tmpl)
        }, status=200)

    elif request.method == 'PUT':
        if not is_admin_or_center_manager(request):
            return JsonResponse({"status": "error", "message": "عذراً، صلاحيات الإدمن أو مدير المركز مطلوبة لتعديل نموذج الامتحان."}, status=403)
        try:
            data = parse_body(request)
            tmpl.title = data.get('title', tmpl.title).strip()
            tmpl.description = data.get('description', tmpl.description)
            if 'pass_score' in data:
                tmpl.pass_score = data['pass_score']
            if 'total_score' in data:
                tmpl.total_score = data['total_score']
            if 'is_active' in data:
                tmpl.is_active = data['is_active']
            tmpl.save(using=db_name)

            if 'questions' in data:
                tmpl.questions.all().delete()
                questions_data = data['questions']
                for idx, q_data in enumerate(questions_data, 1):
                    q_text = q_data.get('question_text', '').strip()
                    if not q_text:
                        continue
                    q_type = q_data.get('question_type', 'MULTIPLE_CHOICE')
                    options = q_data.get('options', [])
                    correct_ans = q_data.get('correct_answer', '')
                    points = q_data.get('points', 10.00)
                    order = q_data.get('order', idx)

                    ExamQuestion.objects.using(db_name).create(
                        template=tmpl,
                        question_text=q_text,
                        question_type=q_type,
                        options=options,
                        correct_answer=correct_ans,
                        points=points,
                        order=order
                    )

            return JsonResponse({
                "status": "success",
                "message": "تم تعديل نموذج الامتحان بنجاح",
                "data": serialize_exam_template(tmpl)
            }, status=200)

        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل تعديل نموذج الامتحان", "details": str(e)}, status=500)

    elif request.method == 'DELETE':
        if not is_admin_or_center_manager(request):
            return JsonResponse({"status": "error", "message": "عذراً، صلاحيات الإدمن أو مدير المركز مطلوبة لحذف نموذج الامتحان."}, status=403)
        try:
            tmpl.is_active = False
            tmpl.save(using=db_name)
            return JsonResponse({"status": "success", "message": "تم إلغاء تنشيط (حذف) نموذج الامتحان بنجاح"})
        except Exception as e:
            return JsonResponse({"status": "error", "message": "فشل حذف نموذج الامتحان", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


# ==============================================================================
# Student Exam Submissions & Scheduling (إجراء الامتحانات وتحديد المواعيد)
# ==============================================================================

@csrf_exempt
def student_exam_schedule_view(request):
    """
    تحديد موعد الامتحان للطالب من قبل مدير المركز
    """
    if request.method != 'POST':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    if not is_admin_or_center_manager(request):
        return JsonResponse({"status": "error", "message": "عذراً، صلاحيات الإدمن أو مدير المركز مطلوبة لتحديد موعد الامتحان."}, status=403)

    try:
        db_name = get_tenant_db(request)
        data = parse_body(request)

        student_id = data.get('student_id')
        stage_id = data.get('stage_id')
        scheduled_date = data.get('scheduled_date')
        notes = data.get('notes', '')

        if not stage_id or not scheduled_date:
            return JsonResponse({"status": "error", "message": "معرف المرحلة (stage_id) وتاريخ الامتحان (scheduled_date) مطلوبان"}, status=400)

        try:
            stage = ProjectStage.objects.using(db_name).select_related('project', 'exam_template').get(id=stage_id)
        except ProjectStage.DoesNotExist:
            return JsonResponse({"status": "error", "message": "المرحلة المطلوبة غير موجودة"}, status=404)

        from tenant_modules.students_and_parents.models import Student
        student = None
        if student_id:
            try:
                student = Student.objects.using(db_name).get(id=student_id)
            except Student.DoesNotExist:
                return JsonResponse({"status": "error", "message": "الطالب غير موجود"}, status=404)

        exam_result, created = StudentExamResult.objects.using(db_name).update_or_create(
            student=student,
            stage=stage,
            defaults={
                'exam_template': stage.exam_template,
                'status': 'SCHEDULED',
                'scheduled_date': scheduled_date,
                'notes': notes
            }
        )

        SystemNotification.objects.using(db_name).create(
            center=student.halaqa.center if (student and student.halaqa) else None,
            title="تم تحديد موعد الامتحان",
            message=f"تم تحديد موعد امتحان المرحلة ({stage.title}) للطالب ({student.full_name if student else ''}) بتاريخ {scheduled_date}"
        )

        return JsonResponse({
            "status": "success",
            "message": "تم تحديد موعد الامتحان للطالب بنجاح",
            "data": {
                "result_id": str(exam_result.id),
                "student_id": str(student.id) if student else None,
                "stage_id": str(stage.id),
                "stage_title": stage.title,
                "status": exam_result.status,
                "scheduled_date": exam_result.scheduled_date.isoformat() if exam_result.scheduled_date else None
            }
        }, status=200)

    except Exception as e:
        return JsonResponse({"status": "error", "message": "فشل تحديد موعد الامتحان", "details": str(e)}, status=500)


@csrf_exempt
def student_exam_submit_view(request):
    """
    تسجيل نتيجة اختبار الطالب واحتساب درجاته وحالة نجاحه
    """
    if request.method != 'POST':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        db_name = get_tenant_db(request)
        data = parse_body(request)

        student_id = data.get('student_id')
        stage_id = data.get('stage_id')
        score = data.get('score')
        answers = data.get('answers', [])
        notes = data.get('notes', '')

        if not stage_id or (not student_id):
            return JsonResponse({"status": "error", "message": "معرف المرحلة (stage_id) ومعرف الطالب (student_id) مطلوبان"}, status=400)

        try:
            stage = ProjectStage.objects.using(db_name).select_related('project', 'exam_template').get(id=stage_id)
        except ProjectStage.DoesNotExist:
            return JsonResponse({"status": "error", "message": "المرحلة المطلوبة غير موجودة"}, status=404)

        from tenant_modules.students_and_parents.models import Student
        try:
            student = Student.objects.using(db_name).get(id=student_id)
        except Student.DoesNotExist:
            return JsonResponse({"status": "error", "message": "الطالب غير موجود"}, status=404)

        tmpl = stage.exam_template
        calculated_score = 0.0
        pass_score = float(tmpl.pass_score) if tmpl else 50.0

        if score is not None:
            calculated_score = float(score)
        elif tmpl and answers:
            questions_dict = {str(q.id): q for q in tmpl.questions.all()}
            for ans in answers:
                q_id = str(ans.get('question_id'))
                given_ans = str(ans.get('given_answer', '')).strip().lower()
                if q_id in questions_dict:
                    q = questions_dict[q_id]
                    if given_ans == str(q.correct_answer).strip().lower():
                        calculated_score += float(q.points)

        status_val = 'PASSED' if calculated_score >= pass_score else 'FAILED'

        exam_result, created = StudentExamResult.objects.using(db_name).update_or_create(
            student=student,
            stage=stage,
            defaults={
                'exam_template': tmpl,
                'score': calculated_score,
                'status': status_val,
                'notes': notes
            }
        )

        msg = f"تهانينا، اجتاز الطالب امتحان المرحلة ({stage.title}) بنجاح!" if status_val == 'PASSED' else f"للأسف، لم يجتز الطالب امتحان المرحلة ({stage.title})."

        return JsonResponse({
            "status": "success",
            "message": msg,
            "data": {
                "result_id": str(exam_result.id),
                "student_id": str(student.id),
                "stage_id": str(stage.id),
                "stage_title": stage.title,
                "score": float(exam_result.score),
                "pass_score": pass_score,
                "status": exam_result.status
            }
        }, status=200)

    except Exception as e:
        return JsonResponse({"status": "error", "message": "فشل تسجيل نتيجة الامتحان", "details": str(e)}, status=500)


@csrf_exempt
def system_notifications_view(request):
    """جلب قائمة الإشعارات المرسلة للإدمن أو مدير المركز"""
    try:
        db_name = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    if request.method == 'GET':
        try:
            notifications = SystemNotification.objects.using(db_name).all().order_by('-created_at')[:50]
            res = [{
                "id": str(n.id),
                "title": n.title,
                "message": n.message,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat()
            } for n in notifications]
            return JsonResponse({"status": "success", "count": len(res), "data": res}, status=200)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "حدث خطأ أثناء جلب الإشعارات", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)