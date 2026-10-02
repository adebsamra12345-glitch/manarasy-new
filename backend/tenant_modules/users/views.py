import json
import traceback
import jwt
from datetime import datetime
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password, check_password

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
        raise ValueError("طµظٹط؛ط© ط§ظ„ط¨ظٹط§ظ†ط§طھ ظپظٹ ط§ظ„ط·ظ„ط¨ ط؛ظٹط± طµط§ظ„ط­ط©")

def get_tenant_db(request):
    tenant_id = request.headers.get('Tenant-ID')
    if not tenant_id:
        raise ValueError("طھط±ظˆظٹط³ط© Tenant-ID ظ…ظپظ‚ظˆط¯ط© ظپظٹ ط§ظ„ط·ظ„ط¨")
    
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
    
    db_name = prof._state.db
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

    data = {
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
        "parent_user_id": str(prof.parent_user.id) if prof.parent_user else None,
        "parent_user_name": f"{prof.parent_user.first_name} {prof.parent_user.last_name}".strip() if prof.parent_user else None,
        "enrollments": enrollments_data
    }

    # Retrieve all student specific fields if they exist
    from tenant_modules.students_and_parents.models import Student, Parent as StudentParentModel
    if prof.role == 'STUDENT' or 'STUDENT' in prof.get_roles():
        try:
            # Try finding student via enrollments first
            student_obj = None
            first_en = prof.enrollments.first()
            if first_en and first_en.student:
                student_obj = first_en.student
            else:
                # Try finding by name or other relations
                full_name_lookup = f"{prof.user.first_name} {prof.user.last_name}".strip()
                student_obj = Student.objects.using(db_name).filter(full_name=full_name_lookup).first()
            
            if student_obj:
                student_fields = ['national_id', 'birth_date', 'gender', 'registration_number', 
                                  'current_residence', 'points', 'rating', 'is_orphan', 
                                  'has_special_needs', 'special_needs_notes', 'income_level', 'general_notes']
                for field in student_fields:
                    val = getattr(student_obj, field, None)
                    if val is not None:
                        # Ensure date serialization
                        if hasattr(val, 'isoformat'):
                            val = val.isoformat()
                        data[field] = val
        except Exception as e:
            pass
            
    if prof.role == 'PARENT' or 'PARENT' in prof.get_roles():
        try:
            full_name_lookup = f"{prof.user.first_name} {prof.user.last_name}".strip()
            parent_obj = StudentParentModel.objects.using(db_name).filter(
                phone=prof.phone or prof.father_phone or prof.mother_phone
            ).first()
            if not parent_obj:
                parent_obj = StudentParentModel.objects.using(db_name).filter(full_name=full_name_lookup).first()
                
            if parent_obj:
                data['parent_email'] = parent_obj.email
                # We can add more parent fields if added to the model later
        except Exception:
            pass

    return data


# ==============================================================================
# Execution Helpers
# ==============================================================================

def check_existing_parent(db_name, guardian_name, guardian_last_name, guardian_type='FATHER'):
    """
    ط§ظ„ط¨ط­ط« ط¹ظ† ظˆظ„ظٹ ط£ظ…ط± ظ†ط´ط· ظٹظ…ظ„ظƒ ظ†ظپط³ (ط§ط³ظ… ط§ظ„ظˆظ„ظٹ ط§ظ„ظ…ط®طھط§ط± ظˆط§ط³ظ… ط§ظ„ط¹ط§ط¦ظ„ط©)
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
    """ط¥ظ†ط´ط§ط، ط­ط³ط§ط¨ ظ…ط³طھط®ط¯ظ… ط¬ط¯ظٹط¯ ظˆط§ظ„طھط£ظƒط¯ ظ…ظ† ط§ظ„ظ‚ظˆط§ط¹ط¯ ظˆط§ظ„ط¥ظ†ط´ط§ط، ط§ظ„طھظ„ظ‚ط§ط¦ظٹ ظ„ظˆظ„ظٹ ط§ظ„ط£ظ…ط±"""
    username = data.get('username', '').strip() if data.get('username') else ''
    password = data.get('password', '').strip()
    role = data.get('role', 'STUDENT')
    roles = data.get('roles', [])
    if roles and isinstance(roles, list) and len(roles) > 0:
        role = roles[0]
    elif role:
        roles = [role]
    else:
        role = 'STUDENT'
        roles = ['STUDENT']

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

    raw_income = data.get('monthly_income')
    monthly_income = raw_income if (raw_income is not None and str(raw_income).strip() != '') else None

    raw_orphan = data.get('orphan_status')
    orphan_status = raw_orphan if raw_orphan in ['m', 'f', 't'] else None

    raw_lat = data.get('latitude')
    latitude = raw_lat if (raw_lat is not None and str(raw_lat).strip() != '') else None

    raw_lng = data.get('longitude')
    longitude = raw_lng if (raw_lng is not None and str(raw_lng).strip() != '') else None

    center_id = data.get('center_id')

    raw_page = data.get('reached_page', 1)
    try:
        reached_page = int(raw_page) if (raw_page is not None and str(raw_page).strip() != '') else 1
    except (ValueError, TypeError):
        reached_page = 1

    is_active = data.get('is_active', True)
    if isinstance(is_active, str):
        is_active = is_active.lower() in ['true', '1', 'yes']

    if ('CENTER_MANAGER' in roles or role == 'CENTER_MANAGER') and not center_id:
        raise ValueError("ط¹ط°ط±ط§ظ‹طŒ ظٹط¬ط¨ طھط­ط¯ظٹط¯ ط§ظ„ظ…ط±ظƒط² ط§ظ„ظ‚ط±ط¢ظ†ظٹ ط§ظ„طھط§ط¨ط¹ ظ„ظ‡ ط§ظ„ظ…ط³طھط®ط¯ظ… ط¹ظ†ط¯ ط§ط®طھظٹط§ط± ط¯ظˆط± (ظ…ط¯ظٹط± ظ…ط±ظƒط²)")

    if ('STUDENT' in roles or role == 'STUDENT') and guardian_type == 'MOTHER':
        if not mother_name or not mother_last_name:
            raise ValueError("ط¹ط°ط±ط§ظ‹طŒ ظ„ط§ ظٹظ…ظƒظ† ط§ط®طھظٹط§ط± ط§ظ„ط£ظ… ظƒظˆظ„ظٹ ط£ظ…ط± ط¥ظ„ط§ ظپظٹ ط­ط§ظ„ ط¥ط¯ط®ط§ظ„ ط§ط³ظ… ط§ظ„ط£ظ… ظˆظƒظ†ظٹطھظ‡ط§")

    # طھظˆظ„ظٹط¯ ط§ط³ظ… ط§ظ„ظ…ط³طھط®ط¯ظ… طھظ„ظ‚ط§ط¦ظٹط§ظ‹ ظپظٹ ط­ط§ظ„ ط¹ط¯ظ… طھظ…ط±ظٹط±ظ‡
    if not username:
        if not first_name and not last_name:
            raise ValueError("ظٹط¬ط¨ ط¥ط¯ط®ط§ظ„ ط§ط³ظ… ط§ظ„ظ…ط³طھط®ط¯ظ… ط£ظˆ (ط§ظ„ط§ط³ظ… ط§ظ„ط£ظˆظ„ ظˆط§ظ„ظƒظ†ظٹط©)")
        base_username = f"{first_name}_{last_name}".strip('_').replace(' ', '_')
        username = base_username
        counter = 1
        while User.objects.using(db_name).filter(username=username).exists():
            username = f"{base_username}_{counter}"
            counter += 1

    if not password or not role:
        raise ValueError("ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ظˆط§ظ„ط¯ظˆط± ظ…ط·ظ„ظˆط¨ط§ظ†")

    if data.get('username') and User.objects.using(db_name).filter(username=username).exists():
        alt_counter = 1
        suggested_username = f"{username}{alt_counter}"
        while User.objects.using(db_name).filter(username=suggested_username).exists():
            alt_counter += 1
            suggested_username = f"{username}{alt_counter}"
        raise ValueError(f"ط§ط³ظ… ط§ظ„ظ…ط³طھط®ط¯ظ… '{username}' ظ…ط³طھط®ط¯ظ… ط¨ط§ظ„ظپط¹ظ„ ظپظٹ ط§ظ„ظ†ط¸ط§ظ…. ظٹظڈظ‚طھط±ط­ ط§ط³طھط®ط¯ط§ظ…: '{suggested_username}'")

    center = None
    if center_id:
        try:
            center = Center.objects.using(db_name).get(id=center_id)
        except Center.DoesNotExist:
            raise ValueError("ط§ظ„ظ…ط±ظƒط² ط§ظ„ظ…ط­ط¯ط¯ ط؛ظٹط± ظ…ظˆط¬ظˆط¯")

    # ظ‚ط§ط¹ط¯ط© ظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط² ط§ظ„ظˆط§ط­ط¯: ظ„ط§ ظٹظ…ظƒظ† ط£ظ† ظٹظƒظˆظ† ظ„ظ„ظ…ط±ظƒط² ط£ظƒط«ط± ظ…ظ† ظ…ط¯ظٹط± ظˆط§ط­ط¯
    if ('CENTER_MANAGER' in roles or role == 'CENTER_MANAGER') and center:
        if center.manager and center.manager.is_active:
            raise ValueError(f"ط§ظ„ظ…ط±ظƒط² '{center.name}' ظٹظ…ظ„ظƒ ظ…ط¯ظٹط±ط§ظ‹ ط¨ط§ظ„ظپط¹ظ„ ظˆظ„ط§ ظٹظ…ظƒظ† ط¥ط¶ط§ظپط© ط£ظƒط«ط± ظ…ظ† ظ…ط¯ظٹط± ظˆط§ط­ط¯ ظ„ظ„ظ…ط±ظƒط²")

    user = User.objects.using(db_name).create(
        username=username,
        password=make_password(password),
        first_name=first_name,
        last_name=last_name,
        email=email,
        is_active=is_active
    )

    if ('CENTER_MANAGER' in roles or role == 'CENTER_MANAGER') and center:
        center.manager = user
        center.save(using=db_name)

    profile = UserProfile.objects.using(db_name).create(
        user=user,
        role=role,
        roles=roles,
        center=center,
        father_name=father_name,
        mother_name=mother_name,
        mother_last_name=mother_last_name,
        guardian_type=guardian_type,
        phone=phone,
        father_phone=father_phone,
        mother_phone=mother_phone,
        health_status=health_status,
        monthly_income=monthly_income,
        orphan_status=orphan_status,
        latitude=latitude,
        longitude=longitude,
        reached_page=reached_page,
        is_active=is_active
    )
    profile.set_roles(roles)
    profile.save(using=db_name)

    parent_profile = None

    # ط§ظ„ط¥ظ†ط´ط§ط، ط§ظ„طھظ„ظ‚ط§ط¦ظٹ ط£ظˆ ط§ظ„ط±ط¨ط· ط¨ط­ط³ط§ط¨ ظˆظ„ظٹ ط§ظ„ط£ظ…ط± ط¹ظ†ط¯ ط¥ظ†ط´ط§ط، ط­ط³ط§ط¨ ط·ط§ظ„ط¨
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

        # ط¥ظ†ط´ط§ط، ظˆظ„ظٹ ط£ظ…ط± ط¬ط¯ظٹط¯ ط¥ط°ط§ ظ„ظ… ظٹظڈط­ط¯ظ‘ط¯ ط­ط³ط§ط¨ ظˆظ„ظٹ ط£ظ…ط± ظ…ظˆط¬ظˆط¯
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
                p_first_name = mother_name if mother_name else f"ط£ظ… {first_name}"
                p_last_name = mother_last_name if mother_last_name else last_name
                p_phone = mother_phone or phone
            else:
                p_first_name = father_name if father_name else f"ظˆظ„ظٹ ط£ظ…ط± {first_name}"
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

        # طھط²ط§ظ…ظ† ط§ظ„ط³ط¬ظ„ ط£ظٹط¶ط§ظ‹ ظ…ط¹ ط¬ط¯ظˆظ„ظٹ Student ظˆ Parent ط¥ظ† ظˆظڈط¬ط¯ط§
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
    """طھط¹ط¯ظٹظ„ ط¨ظٹط§ظ†ط§طھ ط§ظ„ظ…ط³طھط®ط¯ظ… ظˆط§ظ„ط­ظ…ط§ظٹط© ظ„ط­ط³ط§ط¨ manager ط§ظ„ط§ظپطھط±ط§ط¶ظٹ"""
    if user.username == 'manager':
        raise ValueError("ظ„ط§ ظٹظ…ظƒظ† طھط¹ط¯ظٹظ„ ط£ظˆ ط­ط°ظپ ط¨ظٹط§ظ†ط§طھ ط§ظ„ط£ط¯ظ…ظ† ط§ظ„ط§ظپطھط±ط§ط¶ظٹ manager")

    try:
        profile = UserProfile.objects.using(db_name).get(user=user)
    except UserProfile.DoesNotExist:
        profile = UserProfile.objects.using(db_name).create(user=user, role='STUDENT')

    if 'username' in data and data['username'] and data['username'].strip() != user.username:
        new_username = data['username'].strip()
        if User.objects.using(db_name).filter(username=new_username).exclude(id=user.id).exists():
            raise ValueError(f"ط§ط³ظ… ط§ظ„ظ…ط³طھط®ط¯ظ… '{new_username}' ظ…ط³طھط®ط¯ظ… ط¨ط§ظ„ظپط¹ظ„ ظپظٹ ط§ظ„ظ†ط¸ط§ظ…")
        user.username = new_username

    if 'first_name' in data:
        user.first_name = data['first_name']
    if 'last_name' in data:
        user.last_name = data['last_name']
    if 'email' in data:
        user.email = data['email']
    if 'password' in data and data['password']:
        user.password = make_password(data['password'])
    if 'is_active' in data:
        raw_act = data['is_active']
        is_act = raw_act if isinstance(raw_act, bool) else (str(raw_act).lower() in ['true', '1', 'yes'])
        user.is_active = is_act
        profile.is_active = is_act

    user.save(using=db_name)

    if 'roles' in data:
        new_roles = data['roles']
        if not new_roles or not isinstance(new_roles, list) or len(new_roles) == 0:
            raise ValueError("ظٹط¬ط¨ ط§ط®طھظٹط§ط± ط¯ظˆط± ظˆط§ط­ط¯ ط¹ظ„ظ‰ ط§ظ„ط£ظ‚ظ„ ظ„ظ„ظ…ط³طھط®ط¯ظ…")
        profile.set_roles(new_roles)
    elif 'role' in data:
        profile.set_roles([data['role']])

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
        raw_income = data['monthly_income']
        profile.monthly_income = raw_income if (raw_income is not None and str(raw_income).strip() != '') else None
    if 'orphan_status' in data:
        raw_orphan = data['orphan_status']
        profile.orphan_status = raw_orphan if raw_orphan in ['m', 'f', 't'] else None
    if 'latitude' in data:
        raw_lat = data['latitude']
        profile.latitude = raw_lat if (raw_lat is not None and str(raw_lat).strip() != '') else None
    if 'longitude' in data:
        raw_lng = data['longitude']
        profile.longitude = raw_lng if (raw_lng is not None and str(raw_lng).strip() != '') else None
    if 'reached_page' in data:
        raw_page = data['reached_page']
        try:
            profile.reached_page = int(raw_page) if (raw_page is not None and str(raw_page).strip() != '') else 1
        except (ValueError, TypeError):
            profile.reached_page = 1

    if 'center_id' in data:
        if data['center_id']:
            center = Center.objects.using(db_name).get(id=data['center_id'])
            if 'CENTER_MANAGER' in profile.get_roles() and center.manager and center.manager != user:
                raise ValueError("ظ„ط§ ظٹظ…ظƒظ† ط¥ط³ظ†ط§ط¯ ظ…ط¯ظٹط± ظ…ط±ظƒط² ط¬ط¯ظٹط¯ ظ„ظ…ط±ظƒط² ظٹظ…ظ„ظƒ ظ…ط¯ظٹط±ط§ظ‹ ط¨ط§ظ„ظپط¹ظ„")
            profile.center = center
            if 'CENTER_MANAGER' in profile.get_roles():
                center.manager = user
                center.save(using=db_name)
        else:
            profile.center = None

    if 'CENTER_MANAGER' in profile.get_roles() or profile.role == 'CENTER_MANAGER':
        if not profile.center:
            raise ValueError("ط¹ط°ط±ط§ظ‹طŒ ظٹط¬ط¨ طھط­ط¯ظٹط¯ ط§ظ„ظ…ط±ظƒط² ط§ظ„ظ‚ط±ط¢ظ†ظٹ ط§ظ„طھط§ط¨ط¹ ظ„ظ‡ ط§ظ„ظ…ط³طھط®ط¯ظ… ط¹ظ†ط¯ ط¥ط³ظ†ط§ط¯ ط¯ظˆط± (ظ…ط¯ظٹط± ظ…ط±ظƒط²)")

    profile.save(using=db_name)
    return user, profile


def execute_user_delete(db_name, user):
    """ط§ظ„ط­ط°ظپ ط§ظ„ظ„ط·ظٹظپ ظ„ظ„ظ…ط³طھط®ط¯ظ… ط¨ط¯ظˆظ† ط­ط°ظپ ظپظٹط²ظٹط§ط¦ظٹ ظ…ط¹ ط­ظ…ط§ظٹط© manager"""
    if user.username == 'manager':
        raise ValueError("ظ„ط§ ظٹظ…ظƒظ† طھط¹ط¯ظٹظ„ ط£ظˆ ط­ط°ظپ ط¨ظٹط§ظ†ط§طھ ط§ظ„ط£ط¯ظ…ظ† ط§ظ„ط§ظپطھط±ط§ط¶ظٹ manager")

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

        # ط§ظ„طھط¹ط§ظ…ظ„ ظ…ط¹ طھط¨ط¹ط§طھ ط­ط°ظپ ط§ظ„ظ…ط¹ظ„ظ…: ط¥ظ„ط؛ط§ط، ط¥ط³ظ†ط§ط¯ ط§ظ„ط­ظ„ظ‚ط§طھ ط§ظ„ظ…ط±طھط¨ط·ط© ط¨ظ‡
        if profile.role == 'TEACHER' or 'TEACHER' in profile.get_roles():
            from tenant_modules.halaqat.models import Halaqa
            full_name = f"{user.first_name} {user.last_name}".strip()
            teacher_identifiers = [name for name in [full_name, user.username] if name]
            for identifier in teacher_identifiers:
                Halaqa.objects.using(db_name).filter(teacher_name__iexact=identifier).update(teacher_name='')

        # ط¥ظ„ط؛ط§ط، طھظ†ط´ظٹط· ط­ط³ط§ط¨ ط§ظ„ط£ط¨ طھظ„ظ‚ط§ط¦ظٹط§ظ‹ ط¥ط°ط§ ظƒط§ظ† ط§ظ„ظ…ط³طھط®ط¯ظ… ط·ط§ظ„ط¨ ظˆظ„ظٹط³ ظ„ظ„ط£ط¨ ط£ط¨ظ†ط§ط، ط¢ط®ط±ظٹظ† ظ†ط´ط·ظٹظ†
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
        return JsonResponse({"status": "error", "message": "ط§ظ„طھظˆظƒظ† ظ…ظپظ‚ظˆط¯ ط£ظˆ ط؛ظٹط± طµط§ظ„ط­ط©"}, status=401)

    requester_role = token_payload.get('role')
    requester_username = token_payload.get('username')

    try:
        requester_user = User.objects.using(db_name).get(username=requester_username)
        requester_profile = UserProfile.objects.using(db_name).get(user=requester_user)
    except Exception:
        requester_profile = None

    if request.method == 'GET':
        role_param = request.GET.get('role')
        if requester_role != 'TENANT_ADMIN' and role_param != 'TEACHER':
            return JsonResponse({"status": "error", "message": "ط¹ط°ط±ط§ظ‹طŒ ط§ظ„ظˆطµظˆظ„ ظ„طµظپط­ط© ظˆط¥ط¬ط±ط§ط،ط§طھ ط¥ط¯ط§ط±ط© ط§ظ„ظ…ط³طھط®ط¯ظ…ظٹظ† ظ…طھط§ط­ ظپظ‚ط· ظ„ظ…ط¯ظٹط± ط§ظ„ظ†ط¸ط§ظ… ط§ظ„ط±ط¦ظٹط³ظٹ"}, status=403)
        try:
            center_id_param = request.GET.get('center_id')
            status_param = request.GET.get('status')

            if requester_role == 'CENTER_MANAGER':
                if not requester_profile or not requester_profile.center:
                    return JsonResponse({"status": "success", "count": 0, "data": []}, status=200)
                center_id_param = str(requester_profile.center.id)

            if status_param == 'inactive':
                users = User.objects.using(db_name).filter(is_active=False)
            elif status_param == 'all':
                users = User.objects.using(db_name).all()
            else:
                users = User.objects.using(db_name).filter(is_active=True)

            if requester_role == 'CENTER_MANAGER':
                users = users.filter(profile__center=requester_profile.center).exclude(profile__role='TENANT_ADMIN')

            users = users.select_related('profile', 'profile__center').order_by('-date_joined')
            res = []
            for u in users:
                prof = getattr(u, 'profile', None)
                if not prof:
                    continue
                user_roles = prof.get_roles()
                if requester_role == 'CENTER_MANAGER' and ('TENANT_ADMIN' in user_roles or prof.role == 'TENANT_ADMIN'):
                    continue
                if role_param and role_param != 'all':
                    if prof.role != role_param and role_param not in user_roles:
                        continue
                if center_id_param and center_id_param != 'all':
                    if not prof.center or str(prof.center.id) != str(center_id_param):
                        continue

                item = {
                    "id": str(u.id),
                    "username": u.username,
                    "first_name": u.first_name,
                    "last_name": u.last_name,
                    "email": u.email,
                    "role": prof.role if prof else "UNKNOWN",
                    "roles": user_roles,
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
            return JsonResponse({"status": "error", "message": "ط®ط·ط£ ط¹ظ†ط¯ ط§ط³طھط±ط¬ط§ط¹ ظ‚ط§ط¦ظ…ط© ط§ظ„ط­ط³ط§ط¨ط§طھ", "details": str(e)}, status=500)

    elif request.method == 'POST':
        if requester_role != 'TENANT_ADMIN':
            return JsonResponse({"status": "error", "message": "ط¹ط°ط±ط§ظ‹طŒ ط¥ط¶ط§ظپط© ط­ط³ط§ط¨ط§طھ ط§ظ„ظ…ط³طھط®ط¯ظ…ظٹظ† ظ…طھط§ط­ ظپظ‚ط· ظ„ظ…ط¯ظٹط± ط§ظ„ظ†ط¸ط§ظ… ط§ظ„ط±ط¦ظٹط³ظٹ"}, status=403)
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
            guardian_title = "ط§ظ„ط£ظ…" if guardian_type == 'MOTHER' else "ط§ظ„ط£ط¨"

            # ظ…ظ†ط¹ ط§ط®طھظٹط§ط± ط§ظ„ط£ظ… ظƒظˆظ„ظٹ ط£ظ…ط± ط¥ظ„ط§ ط¹ظ†ط¯ ط£ط¯ط®ط§ظ„ ط§ط³ظ… ط§ظ„ط£ظ… ظˆظƒظ†ظٹطھظ‡ط§
            if target_role == 'STUDENT' and guardian_type == 'MOTHER':
                if not mother_name.strip() or not mother_last_name.strip():
                    return JsonResponse({
                        "status": "error",
                        "message": "ط¹ط°ط±ط§ظ‹طŒ ظ„ط§ ظٹظ…ظƒظ† ط§ط®طھظٹط§ط± ط§ظ„ط£ظ… ظƒظˆظ„ظٹ ط£ظ…ط± ط¥ظ„ط§ ظپظٹ ط­ط§ظ„ ط¥ط¯ط®ط§ظ„ ط§ط³ظ… ط§ظ„ط£ظ… ظˆظƒظ†ظٹطھظ‡ط§"
                    }, status=400)

            # ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† ظˆط¬ظˆط¯ ظˆظ„ظٹ ط£ظ…ط± ظ…ط·ط§ط¨ظ‚ ط¹ظ†ط¯ ط¥ظ†ط´ط§ط، ط·ط§ظ„ط¨ ط¥ط°ط§ ظ„ظ… ظٹطھظ… طھط£ظƒظٹط¯ ط§ظ„ط§ط®طھظٹط§ط±
            if target_role == 'STUDENT' and not existing_parent_id and not create_new_parent:
                existing_p = check_existing_parent(db_name, guardian_name, guardian_last_name, guardian_type)
                if existing_p:
                    ex_user, ex_prof = existing_p
                    return JsonResponse({
                        "status": "warning_parent_exists",
                        "message": f"طھظ†ط¨ظٹظ‡: ظٹظˆط¬ط¯ ظˆظ„ظٹ ط£ظ…ط± ظ…ط³ط¬ظ„ ط¨ط§ظ„ظپط¹ظ„ ط¨ط§ط³ظ… '{ex_user.first_name} {ex_user.last_name}' (ط§ط³ظ… ط§ظ„ظ…ط³طھط®ط¯ظ…: {ex_user.username}). ظ‡ظ„ طھط±ط؛ط¨ ظپظٹ ط±ط¨ط· ظ‡ط°ط§ ط§ظ„ط·ط§ظ„ط¨ ط¨ط§ظ„ط­ط³ط§ط¨ ط§ظ„ط­ط§ظ„ظٹ ظƒظ€ ({guardian_title}) ط£ظ… ط¥ظ†ط´ط§ط، ط­ط³ط§ط¨ ظˆظ„ظٹ ط£ظ…ط± ط¬ط¯ظٹط¯طں",
                        "requires_parent_confirmation": True,
                        "guardian_type": guardian_type,
                        "existing_parent": {
                            "id": str(ex_user.id),
                            "username": ex_user.username,
                            "full_name": f"{ex_user.first_name} {ex_user.last_name}".strip(),
                            "phone": ex_prof.phone or ex_prof.father_phone or ex_prof.mother_phone or ""
                        }
                    }, status=400)

            # 1. ط§ظ„ظ…ط¹ظ„ظ… طھظ‚ط¯ظٹظ… ط·ظ„ط¨ ظپظ‚ط· ط¯ظˆظ† ط§ظ„طھظ†ظپظٹط° ط§ظ„ظپط¹ظ„ظٹ
            if requester_role == 'TEACHER':
                if target_role != 'STUDENT':
                    return JsonResponse({"status": "error", "message": "ظ„ط§ ظٹط­ظ‚ ظ„ظ„ظ…ط¹ظ„ظ… طھظ‚ط¯ظٹظ… ط·ظ„ط¨ ظ„ط؛ظٹط± ط­ط³ط§ط¨ط§طھ ط§ظ„ط·ظ„ط§ط¨"}, status=403)

                # ط¥ط¶ط§ظپط© ظ…ظ„ط§ط­ط¸ط© ط§ظ„طھظ†ط¨ظٹظ‡ ظپظٹ ط¨ظٹط§ظ†ط§طھ ط§ظ„ط·ظ„ط¨ ظ„ظ„ط¸ظ‡ظˆط± ظ„ظ„ط£ط¯ظ…ظ† ظˆظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط²
                if existing_parent_id:
                    try:
                        ex_u = User.objects.using(db_name).get(id=existing_parent_id)
                        data['parent_note'] = f"ظ…ظ„ط§ط­ط¸ط© ط§ظ„ظ…ط¹ظ„ظ…: ظ‚ط§ظ… ط§ظ„ظ…ط¹ظ„ظ… ط¨ط§ط®طھظٹط§ط± ط±ط¨ط· ط§ظ„ط·ط§ظ„ط¨ ط¨ظˆظ„ظٹ ط§ظ„ط£ظ…ط± ط§ظ„ط­ط§ظ„ظٹ '{ex_u.first_name} {ex_u.last_name}' ({ex_u.username}) ظƒظ€ ({guardian_title})."
                    except Exception:
                        pass
                elif create_new_parent:
                    data['parent_note'] = f"ظ…ظ„ط§ط­ط¸ط© ط§ظ„ظ…ط¹ظ„ظ…: ط§ط®طھط§ط± ط§ظ„ظ…ط¹ظ„ظ… ط¥ظ†ط´ط§ط، ط­ط³ط§ط¨ ظˆظ„ظٹ ط£ظ…ط± ط¬ط¯ظٹط¯ ({guardian_title}) ط±ط؛ظ… ظˆط¬ظˆط¯ ط­ط³ط§ط¨ ط¢ط®ط± ط¨ظ†ظپط³ ط§ظ„ط§ط³ظ…."

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
                    "message": "طھظ… طھظ‚ط¯ظٹظ… ط·ظ„ط¨ ط¥ظ†ط´ط§ط، ط­ط³ط§ط¨ ط§ظ„ط·ط§ظ„ط¨ ط¨ظ†ط¬ط§ط­طŒ ط¨ط§ظ†طھط¸ط§ط± ظ…ظˆط§ظپظ‚ط© ظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط² ط£ظˆ ط§ظ„ط£ط¯ظ…ظ† ط§ظ„ط±ط¦ظٹط³ظٹ",
                    "request_id": str(account_req.id)
                }, status=202)

            # 2. ظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط² ظٹظ…ظ†ط¹ ظ…ظ† ط¥ظ†ط´ط§ط، ط£ط¯ظ…ظ† ط£ظˆ ظ…ط¯ظٹط± ظ…ط±ظƒط² ط¢ط®ط±
            if requester_role == 'CENTER_MANAGER':
                if target_role in ['TENANT_ADMIN', 'CENTER_MANAGER']:
                    return JsonResponse({"status": "error", "message": "ظ„ط§ ظٹط­ظ‚ ظ„ظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط² ط¥ظ†ط´ط§ط، ط­ط³ط§ط¨ط§طھ ط£ط¯ظ…ظ† ط±ط¦ظٹط³ظٹ ط£ظˆ ظ…ط¯ط±ط§ط، ظ…ط±ط§ظƒط² ط¢ط®ط±ظٹظ†"}, status=403)
                
                if requester_profile and requester_profile.center:
                    data['center_id'] = str(requester_profile.center.id)

            # 3. ط§ظ„ط£ط¯ظ…ظ† ط§ظ„ط±ط¦ظٹط³ظٹ ظٹظ…ظ„ظƒ ظƒط§ظ…ظ„ ط§ظ„طµظ„ط§ط­ظٹط©
            if requester_role not in ['TENANT_ADMIN', 'CENTER_MANAGER']:
                return JsonResponse({"status": "error", "message": "طµظ„ط§ط­ظٹط§طھ ط§ظ„ط£ط¯ظ…ظ† ط£ظˆ ظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط² ظ…ط·ظ„ظˆط¨ط© ظ„ط¥ظ†ط´ط§ط، ط­ط³ط§ط¨ط§طھ"}, status=403)

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
                "message": "طھظ… ط¥ظ†ط´ط§ط، ط§ظ„ط­ط³ط§ط¨ ط¨ظ†ط¬ط§ط­",
                "data": resp_data
            }, status=201)

        except ValueError as e:
            return JsonResponse({"status": "error", "message": str(e)}, status=400)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "ط­ط¯ط« ط®ط·ط£ ط؛ظٹط± ظ…طھظˆظ‚ط¹ ط£ط«ظ†ط§ط، ط¥ظ†ط´ط§ط، ط§ظ„ط­ط³ط§ط¨", "details": str(e)}, status=500)
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
        return JsonResponse({"status": "error", "message": "ط§ظ„طھظˆظƒظ† ظ…ظپظ‚ظˆط¯ ط£ظˆ ط؛ظٹط± طµط§ظ„ط­ط©"}, status=401)

    requester_role = token_payload.get('role')
    requester_username = token_payload.get('username')

    try:
        requester_user = User.objects.using(db_name).get(username=requester_username)
        requester_profile = UserProfile.objects.using(db_name).get(user=requester_user)
    except Exception:
        requester_profile = None

    try:
        target_user = User.objects.using(db_name).get(id=pk)
        target_profile = UserProfile.objects.using(db_name).get(user=target_user)
    except User.DoesNotExist:
        return JsonResponse({"status": "error", "message": "ط§ظ„ط­ط³ط§ط¨ ط§ظ„ظ…ط·ظ„ظˆط¨ ط؛ظٹط± ظ…ظˆط¬ظˆط¯"}, status=404)
    except UserProfile.DoesNotExist:
        target_profile = UserProfile.objects.using(db_name).create(user=target_user, role='STUDENT')

    if requester_role != 'TENANT_ADMIN':
        return JsonResponse({"status": "error", "message": "ط¹ط°ط±ط§ظ‹طŒ ط§ظ„ظˆطµظˆظ„ ظ„ط¨ظٹط§ظ†ط§طھ ظˆط¥ط¬ط±ط§ط،ط§طھ ط¥ط¯ط§ط±ط© ظ‡ط°ط§ ط§ظ„ظ…ط³طھط®ط¯ظ… ظ…طھط§ط­ ظپظ‚ط· ظ„ظ…ط¯ظٹط± ط§ظ„ظ†ط¸ط§ظ… ط§ظ„ط±ط¦ظٹط³ظٹ"}, status=403)

    # ط­ظ…ط§ظٹط© manager ط§ظ„ط§ظپطھط±ط§ط¶ظٹ
    if target_user.username == 'manager' and request.method in ['PUT', 'PATCH', 'DELETE']:
        return JsonResponse({"status": "error", "message": "ظ„ط§ ظٹظ…ظƒظ† طھط¹ط¯ظٹظ„ ط£ظˆ ط­ط°ظپ ط¨ظٹط§ظ†ط§طھ ط§ظ„ط£ط¯ظ…ظ† ط§ظ„ط§ظپطھط±ط§ط¶ظٹ manager"}, status=403)

    if request.method == 'GET':
        data = {
            "id": str(target_user.id),
            "username": target_user.username,
            "first_name": target_user.first_name,
            "last_name": target_user.last_name,
            "email": target_user.email,
            "role": target_profile.role,
            "roles": target_profile.get_roles(),
            "center_id": str(target_profile.center.id) if target_profile.center else None,
            "center_name": target_profile.center.name if target_profile.center else None,
            "is_active": target_user.is_active,
            "created_at": target_user.date_joined.isoformat(),
            "last_login": target_user.last_login.isoformat() if target_user.last_login else None
        }
        data.update(serialize_profile(target_profile))
        return JsonResponse({"status": "success", "data": data}, status=200)

    elif request.method in ['PUT', 'PATCH']:
        data = parse_body(request)

        if requester_role == 'TEACHER':
            if target_profile.role != 'STUDENT':
                return JsonResponse({"status": "error", "message": "ظ„ط§ ظٹط­ظ‚ ظ„ظ„ظ…ط¹ظ„ظ… طھط¹ط¯ظٹظ„ ط؛ظٹط± ط­ط³ط§ط¨ط§طھ ط§ظ„ط·ظ„ط§ط¨"}, status=403)

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
                "message": "طھظ… طھظ‚ط¯ظٹظ… ط·ظ„ط¨ طھط¹ط¯ظٹظ„ ط­ط³ط§ط¨ ط§ظ„ط·ط§ظ„ط¨ ط¨ظ†ط¬ط§ط­طŒ ط¨ط§ظ†طھط¸ط§ط± ظ…ظˆط§ظپظ‚ط© ظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط² ط£ظˆ ط§ظ„ط£ط¯ظ…ظ†",
                "request_id": str(account_req.id)
            }, status=202)

        if requester_role == 'CENTER_MANAGER':
            if target_profile.role in ['TENANT_ADMIN', 'CENTER_MANAGER']:
                return JsonResponse({"status": "error", "message": "ظ„ط§ ظٹط­ظ‚ ظ„ظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط² طھط¹ط¯ظٹظ„ ط­ط³ط§ط¨ط§طھ ط§ظ„ط£ط¯ظ…ظ† ط§ظ„ط±ط¦ظٹط³ظٹ ط£ظˆ ظ…ط¯ط±ط§ط، ط§ظ„ظ…ط±ط§ظƒط²"}, status=403)
            if requester_profile and requester_profile.center:
                data['center_id'] = str(requester_profile.center.id)

        if requester_role not in ['TENANT_ADMIN', 'CENTER_MANAGER']:
            return JsonResponse({"status": "error", "message": "طµظ„ط§ط­ظٹط§طھ ط؛ظٹط± ظƒط§ظپظٹط© ظ„طھط¹ط¯ظٹظ„ ظ‡ط°ط§ ط§ظ„ط­ط³ط§ط¨"}, status=403)

        try:
            execute_user_update(db_name, target_user, data)
            return JsonResponse({"status": "success", "message": "طھظ… طھط¹ط¯ظٹظ„ ط¨ظٹط§ظ†ط§طھ ط§ظ„ط­ط³ط§ط¨ ط¨ظ†ط¬ط§ط­"})
        except ValueError as e:
            return JsonResponse({"status": "error", "message": str(e)}, status=400)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "ظپط´ظ„ طھط¹ط¯ظٹظ„ ط¨ظٹط§ظ†ط§طھ ط§ظ„ط­ط³ط§ط¨", "details": str(e)}, status=500)

    elif request.method == 'DELETE':
        if requester_role == 'TEACHER':
            if target_profile.role != 'STUDENT':
                return JsonResponse({"status": "error", "message": "ظ„ط§ ظٹط­ظ‚ ظ„ظ„ظ…ط¹ظ„ظ… ط­ط°ظپ ط؛ظٹط± ط­ط³ط§ط¨ط§طھ ط§ظ„ط·ظ„ط§ط¨"}, status=403)

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
                "message": "طھظ… طھظ‚ط¯ظٹظ… ط·ظ„ط¨ ط­ط°ظپ ط­ط³ط§ط¨ ط§ظ„ط·ط§ظ„ط¨ ط¨ظ†ط¬ط§ط­طŒ ط¨ط§ظ†طھط¸ط§ط± ظ…ظˆط§ظپظ‚ط© ظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط² ط£ظˆ ط§ظ„ط£ط¯ظ…ظ†",
                "request_id": str(account_req.id)
            }, status=202)

        if requester_role == 'CENTER_MANAGER':
            if target_profile.role in ['TENANT_ADMIN', 'CENTER_MANAGER']:
                return JsonResponse({"status": "error", "message": "ظ„ط§ ظٹط­ظ‚ ظ„ظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط² ط­ط°ظپ ط­ط³ط§ط¨ط§طھ ط§ظ„ط£ط¯ظ…ظ† ط§ظ„ط±ط¦ظٹط³ظٹ ط£ظˆ ظ…ط¯ط±ط§ط، ط§ظ„ظ…ط±ط§ظƒط²"}, status=403)

        if requester_role not in ['TENANT_ADMIN', 'CENTER_MANAGER']:
            return JsonResponse({"status": "error", "message": "طµظ„ط§ط­ظٹط§طھ ط§ظ„ط£ط¯ظ…ظ† ط§ظ„ط±ط¦ظٹط³ظٹ ط£ظˆ ظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط² ظ…ط·ظ„ظˆط¨ط© ظ„ط­ط°ظپ ظ‡ط°ط§ ط§ظ„ط­ط³ط§ط¨"}, status=403)

        if target_user.username == requester_username:
            return JsonResponse({"status": "error", "message": "ظ„ط§ ظٹظ…ظƒظ†ظƒ ط­ط°ظپ ط­ط³ط§ط¨ظƒ ط§ظ„ط´ط®طµظٹ ط§ظ„ط­ط§ظ„ظٹ ط£ط«ظ†ط§ط، طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„"}, status=400)

        try:
            execute_user_delete(db_name, target_user)
            user_label = "ط­ط³ط§ط¨ ط§ظ„ظ…ط¹ظ„ظ…" if target_profile.role == 'TEACHER' or 'TEACHER' in target_profile.get_roles() else "ط§ظ„ط­ط³ط§ط¨"
            target_name = f"{target_user.first_name} {target_user.last_name}".strip() or target_user.username
            return JsonResponse({"status": "success", "message": f"طھظ… ط­ط°ظپ {user_label} ({target_name}) ط¨ظ†ط¬ط§ط­"})
        except ValueError as e:
            return JsonResponse({"status": "error", "message": str(e)}, status=400)
        except Exception as e:
            return JsonResponse({"status": "error", "message": "ظپط´ظ„ ط­ط°ظپ ط§ظ„ط­ط³ط§ط¨", "details": str(e)}, status=500)

    return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)


@csrf_exempt
def user_impersonate_view(request, pk):
    """
    طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„ ظƒط£ظٹ ظ…ط³طھط®ط¯ظ… ط¨ط¯ظˆظ† ظƒظ„ظ…ط© ط³ط± (ط®ط§طµظٹط© ط§ظ„ط£ط¯ظ…ظ† ظˆظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط² ظ„ظ„ظ…ط³طھظ‡ط¯ظپظٹظ† ظ…ظ† ظ…ط±ظƒط²ظ‡)
    """
    if request.method != 'POST':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        db_name, tenant = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    token_payload = get_token_payload(request)
    if not token_payload:
        return JsonResponse({"status": "error", "message": "ط§ظ„طھظˆظƒظ† ظ…ظپظ‚ظˆط¯ط© ط£ظˆ ط؛ظٹط± طµط§ظ„ط­ط©"}, status=401)

    requester_role = token_payload.get('role')
    requester_username = token_payload.get('username')
    if requester_role != 'TENANT_ADMIN':
        return JsonResponse({"status": "error", "message": "طµظ„ط§ط­ظٹط§طھ ط§ظ„ط£ط¯ظ…ظ† ط§ظ„ط±ط¦ظٹط³ظٹ ظ…ط·ظ„ظˆط¨ط© ظ„ط§ط³طھط®ط¯ط§ظ… ط§ظ„ط¯ط®ظˆظ„ ط¨ط¯ظٹظ„ ط§ظ„ط­ط³ط§ط¨"}, status=403)

    try:
        target_user = User.objects.using(db_name).get(id=pk)
        target_profile = UserProfile.objects.using(db_name).get(user=target_user)
    except User.DoesNotExist:
        return JsonResponse({"status": "error", "message": "ط§ظ„ظ…ط³طھط®ط¯ظ… ط§ظ„ظ…ط³طھظ‡ط¯ظپ ط؛ظٹط± ظ…ظˆط¬ظˆط¯"}, status=404)
    except UserProfile.DoesNotExist:
        target_profile = UserProfile.objects.using(db_name).create(user=target_user, role='STUDENT')

    if requester_role == 'CENTER_MANAGER':
        try:
            requester_user = User.objects.using(db_name).get(username=requester_username)
            requester_profile = UserProfile.objects.using(db_name).get(user=requester_user)
        except Exception:
            requester_profile = None

        if not requester_profile or not requester_profile.center or target_profile.center != requester_profile.center:
            return JsonResponse({"status": "error", "message": "ظ„ط§ ظٹط­ظ‚ ظ„ظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط² ط§ظ„ط¯ط®ظˆظ„ ط¨ط­ط³ط§ط¨ط§طھ ط®ط§ط±ط¬ ظ…ط±ظƒط²ظ‡"}, status=403)

        if target_profile.role in ['TENANT_ADMIN', 'CENTER_MANAGER']:
            return JsonResponse({"status": "error", "message": "ظ„ط§ ظٹط­ظ‚ ظ„ظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط² ط§ظ„ط¯ط®ظˆظ„ ط¨ط­ط³ط§ط¨ ط£ط¯ظ…ظ† ط£ظˆ ظ…ط¯ظٹط± ظ…ط±ظƒط² ط¢ط®ط±"}, status=403)

    user_roles = target_profile.get_roles()
    jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
    access_lifetime = getattr(settings, 'JWT_ACCESS_TOKEN_LIFETIME_MINUTES', 60)
    now = datetime.utcnow()
    payload = {
        "tenant_id": str(tenant.id),
        "subdomain": tenant.subdomain,
        "username": target_user.username,
        "user_id": str(target_user.id),
        "role": target_profile.role,
        "roles": user_roles,
        "impersonated_by": token_payload.get('username'),
        "exp": now + timezone.timedelta(minutes=int(access_lifetime)),
        "iat": now
    }

    token = jwt.encode(payload, jwt_secret, algorithm="HS256")

    return JsonResponse({
        "status": "success",
        "message": f"طھظ… طھط³ط¬ظٹظ„ ط§ظ„ط¯ط®ظˆظ„ ط¨ظ†ط¬ط§ط­ ط¨ط­ط³ط§ط¨ ط§ظ„ظ…ط³طھط®ط¯ظ… {target_user.username}",
        "data": {
            "access_token": token,
            "token_type": "Bearer",
            "user": {
                "id": str(target_user.id),
                "username": target_user.username,
                "first_name": target_user.first_name,
                "last_name": target_user.last_name,
                "role": target_profile.role,
                "roles": user_roles
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
        return JsonResponse({"status": "error", "message": "طµظ„ط§ط­ظٹط§طھ ط§ظ„ط£ط¯ظ…ظ† ط£ظˆ ظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط² ظ…ط·ظ„ظˆط¨ط© ظ„ظ…ط´ط§ظ‡ط¯ط© ط§ظ„ط·ظ„ط¨ط§طھ"}, status=403)

    requester_role = token_payload.get('role')
    requester_username = token_payload.get('username')

    if request.method == 'GET':
        try:
            reqs = AccountRequest.objects.using(db_name).filter(status='PENDING').select_related('requested_by', 'target_user', 'center').order_by('-created_at')

            if requester_role == 'CENTER_MANAGER':
                try:
                    requester_user = User.objects.using(db_name).get(username=requester_username)
                    requester_profile = UserProfile.objects.using(db_name).get(user=requester_user)
                    if requester_profile and requester_profile.center:
                        reqs = reqs.filter(center=requester_profile.center)
                    else:
                        reqs = reqs.none()
                except Exception:
                    reqs = reqs.none()

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
            return JsonResponse({"status": "error", "message": "ط­ط¯ط« ط®ط·ط£ ط£ط«ظ†ط§ط، ط§ط³طھط±ط¬ط§ط¹ ظ‚ط§ط¦ظ…ط© ط§ظ„ط·ظ„ط¨ط§طھ", "details": str(e)}, status=500)

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
        return JsonResponse({"status": "error", "message": "طµظ„ط§ط­ظٹط§طھ ط§ظ„ط£ط¯ظ…ظ† ط£ظˆ ظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط² ظ…ط·ظ„ظˆط¨ط© ظ„ظ„ظ…ظˆط§ظپظ‚ط© ط¹ظ„ظ‰ ط§ظ„ط·ظ„ط¨ط§طھ"}, status=403)

    requester_role = token_payload.get('role')
    requester_username = token_payload.get('username')

    try:
        acc_req = AccountRequest.objects.using(db_name).get(id=pk, status='PENDING')
    except AccountRequest.DoesNotExist:
        return JsonResponse({"status": "error", "message": "ط§ظ„ط·ظ„ط¨ ط§ظ„ظ…ط¹ظ„ظ‚ ط؛ظٹط± ظ…ظˆط¬ظˆط¯ ط£ظˆ طھظ… ط§طھط®ط§ط° ط¥ط¬ط±ط§ط، ط¹ظ„ظٹظ‡ ط³ط§ط¨ظ‚ط§ظ‹"}, status=404)

    if requester_role == 'CENTER_MANAGER':
        try:
            requester_user = User.objects.using(db_name).get(username=requester_username)
            requester_profile = UserProfile.objects.using(db_name).get(user=requester_user)
            if not requester_profile or not requester_profile.center or acc_req.center != requester_profile.center:
                return JsonResponse({"status": "error", "message": "ظ„ط§ ظٹط­ظ‚ ظ„ظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط² ط§ظ„ظ…ظˆط§ظپظ‚ط© ط¹ظ„ظ‰ ط·ظ„ط¨ط§طھ ط®ط§ط±ط¬ ظ…ط±ظƒط²ظ‡"}, status=403)
        except Exception:
            return JsonResponse({"status": "error", "message": "ط®ط·ط£ ظپظٹ ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† ظ…ظ„ظپ ظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط²"}, status=403)

    reviewer_user = User.objects.using(db_name).get(username=requester_username)

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

        return JsonResponse({"status": "success", "message": "طھظ…طھ ط§ظ„ظ…ظˆط§ظپظ‚ط© ط¹ظ„ظ‰ ط§ظ„ط·ظ„ط¨ ظˆطھظ†ظپظٹط°ظ‡ ط¨ظ†ط¬ط§ط­ ط¹ظ„ظ‰ ظ‚ط§ط¹ط¯ط© ط§ظ„ط¨ظٹط§ظ†ط§طھ"})

    except ValueError as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)
    except Exception as e:
        return JsonResponse({"status": "error", "message": "ظپط´ظ„ طھظ†ظپظٹط° ط§ظ„ط·ظ„ط¨", "details": str(e)}, status=500)


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
        return JsonResponse({"status": "error", "message": "طµظ„ط§ط­ظٹط§طھ ط§ظ„ط£ط¯ظ…ظ† ط£ظˆ ظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط² ظ…ط·ظ„ظˆط¨ط© ظ„ط±ظپط¶ ط§ظ„ط·ظ„ط¨ط§طھ"}, status=403)

    requester_role = token_payload.get('role')
    requester_username = token_payload.get('username')

    try:
        acc_req = AccountRequest.objects.using(db_name).get(id=pk, status='PENDING')
    except AccountRequest.DoesNotExist:
        return JsonResponse({"status": "error", "message": "ط§ظ„ط·ظ„ط¨ ط؛ظٹط± ظ…ظˆط¬ظˆط¯ ط£ظˆ طھظ… ط§طھط®ط§ط° ط¥ط¬ط±ط§ط، ط¹ظ„ظٹظ‡ ط³ط§ط¨ظ‚ط§ظ‹"}, status=404)

    if requester_role == 'CENTER_MANAGER':
        try:
            requester_user = User.objects.using(db_name).get(username=requester_username)
            requester_profile = UserProfile.objects.using(db_name).get(user=requester_user)
            if not requester_profile or not requester_profile.center or acc_req.center != requester_profile.center:
                return JsonResponse({"status": "error", "message": "ظ„ط§ ظٹط­ظ‚ ظ„ظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط² ط±ظپط¶ ط·ظ„ط¨ط§طھ ط®ط§ط±ط¬ ظ…ط±ظƒط²ظ‡"}, status=403)
        except Exception:
            return JsonResponse({"status": "error", "message": "ط®ط·ط£ ظپظٹ ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† ظ…ظ„ظپ ظ…ط¯ظٹط± ط§ظ„ظ…ط±ظƒط²"}, status=403)

    data = parse_body(request)
    reviewer_user = User.objects.using(db_name).get(username=requester_username)

    acc_req.status = 'REJECTED'
    acc_req.reviewed_by = reviewer_user
    acc_req.rejection_reason = data.get('reason', 'طھظ… ط±ظپط¶ ط§ظ„ط·ظ„ط¨ ط¨ظˆط§ط³ط·ط© ط§ظ„ظ…ط³ط¤ظˆظ„')
    acc_req.save(using=db_name)

    return JsonResponse({"status": "success", "message": "طھظ… ط±ظپط¶ ط§ظ„ط·ظ„ط¨ ط¨ظ†ط¬ط§ط­"})


@csrf_exempt
def user_me_view(request):
    if request.method != 'GET':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        db_name, tenant = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    token_payload = get_token_payload(request)
    if not token_payload:
        return JsonResponse({"status": "error", "message": "ط§ظ„طھظˆظƒظ† ظ…ظپظ‚ظˆط¯ط© ط£ظˆ ط؛ظٹط± طµط§ظ„ط­ط©"}, status=401)

    username = token_payload.get('username')
    try:
        user = User.objects.using(db_name).get(username=username)
        profile = UserProfile.objects.using(db_name).get(user=user)
    except User.DoesNotExist:
        return JsonResponse({"status": "error", "message": "ط§ظ„ظ…ط³طھط®ط¯ظ… ط؛ظٹط± ظ…ظˆط¬ظˆط¯"}, status=404)
    except UserProfile.DoesNotExist:
        profile = UserProfile.objects.using(db_name).create(user=user, role='STUDENT', roles=['STUDENT'])

    center_id = str(profile.center.id) if profile.center else None
    center_name = profile.center.name if profile.center else None

    data = {
        "id": str(user.id),
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "role": profile.role,
        "roles": profile.get_roles(),
        "center_id": center_id,
        "center_name": center_name,
        "is_active": user.is_active,
    }
    data.update(serialize_profile(profile))
    return JsonResponse({"status": "success", "data": data}, status=200)


@csrf_exempt
def switch_active_role_view(request):
    if request.method != 'POST':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        db_name, tenant = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    token_payload = get_token_payload(request)
    if not token_payload:
        return JsonResponse({"status": "error", "message": "ط§ظ„طھظˆظƒظ† ظ…ظپظ‚ظˆط¯ط© ط£ظˆ ط؛ظٹط± طµط§ظ„ط­ط©"}, status=401)

    data = parse_body(request)
    requested_role = str(data.get('role', '')).upper().strip()

    if not requested_role:
        return JsonResponse({"status": "error", "message": "ظٹط±ط¬ظ‰ طھط­ط¯ظٹط¯ ط§ظ„ط¯ظˆط± ط§ظ„ظ…ط±ط§ط¯ ط§ظ„طھط¨ط¯ظٹظ„ ط¥ظ„ظٹظ‡"}, status=400)

    username = token_payload.get('username')
    try:
        user = User.objects.using(db_name).get(username=username)
        profile = UserProfile.objects.using(db_name).get(user=user)
    except (User.DoesNotExist, UserProfile.DoesNotExist):
        return JsonResponse({"status": "error", "message": "ط§ظ„ظ…ط³طھط®ط¯ظ… ط؛ظٹط± ظ…ظˆط¬ظˆط¯"}, status=404)

    user_roles = profile.get_roles()

    if requested_role not in user_roles:
        return JsonResponse({
            "status": "error",
            "message": "ط¹ط°ط±ط§ظ‹طŒ ظ‡ط°ط§ ط§ظ„ط¯ظˆط± ط؛ظٹط± ظ…ط³ظ†ط¯ ظ„ط­ط³ط§ط¨ظƒ"
        }, status=403)

    # طھط­ط¯ظٹط« ط§ظ„ط¯ظˆط± ط§ظ„ظ†ط´ط· ظپظٹ ظ‚ط§ط¹ط¯ط© ط§ظ„ط¨ظٹط§ظ†ط§طھ
    profile.role = requested_role
    profile.save(using=db_name)

    profile_center_id = str(profile.center.id) if profile.center else None
    profile_center_name = profile.center.name if profile.center else None

    # طھظˆظ„ظٹط¯ طھظˆظƒظ† ط¬ط¯ظٹط¯ ط¨ط§ظ„ط¯ظˆط± ط§ظ„ظ†ط´ط· ط§ظ„ط¬ط¯ظٹط¯
    jwt_secret = getattr(settings, 'JWT_SECRET_KEY', settings.SECRET_KEY)
    access_lifetime = getattr(settings, 'JWT_ACCESS_TOKEN_LIFETIME_MINUTES', 60)
    now = datetime.utcnow()

    new_payload = {
        "tenant_id": str(tenant.id),
        "subdomain": tenant.subdomain,
        "username": user.username,
        "user_id": str(user.id),
        "role": requested_role,
        "roles": user_roles,
        "center_id": profile_center_id,
        "center_name": profile_center_name,
        "exp": now + timezone.timedelta(minutes=int(access_lifetime)),
        "iat": now
    }
    new_token = jwt.encode(new_payload, jwt_secret, algorithm="HS256")

    return JsonResponse({
        "status": "success",
        "message": f"طھظ… ط§ظ„طھط¨ط¯ظٹظ„ ط¥ظ„ظ‰ ط¯ظˆط± {requested_role} ط¨ظ†ط¬ط§ط­",
        "data": {
            "access_token": new_token,
            "token_type": "Bearer",
            "user": {
                "id": str(user.id),
                "username": user.username,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": profile.role,
                "roles": user_roles,
                "center_id": profile_center_id,
                "center_name": profile_center_name
            }
        }
    }, status=200)


@csrf_exempt
def change_password_view(request):
    if request.method != 'POST':
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    try:
        db_name, tenant = get_tenant_db(request)
    except Exception as e:
        return JsonResponse({"status": "error", "message": str(e)}, status=400)

    token_payload = get_token_payload(request)
    if not token_payload:
        return JsonResponse({"status": "error", "message": "التوكن مفقودة أو غير صالحة"}, status=401)

    username = token_payload.get('username')
    try:
        user = User.objects.using(db_name).get(username=username)
    except User.DoesNotExist:
        return JsonResponse({"status": "error", "message": "المستخدم غير موجود"}, status=404)

    data = parse_body(request)
    current_password = data.get('current_password')
    new_password = data.get('new_password')
    confirm_password = data.get('confirm_password')

    if not current_password or not new_password or not confirm_password:
        return JsonResponse({"status": "error", "message": "يرجى تعبئة جميع الحقول المطلوبة"}, status=400)

    if new_password != confirm_password:
        return JsonResponse({"status": "error", "message": "كلمة المرور الجديدة غير متطابقة مع التأكيد"}, status=400)

    if len(new_password) < 6:
        return JsonResponse({"status": "error", "message": "يجب أن تكون كلمة المرور الجديدة 6 أحرف على الأقل"}, status=400)

    if not check_password(current_password, user.password):
        return JsonResponse({"status": "error", "message": "كلمة المرور الحالية غير صحيحة"}, status=400)

    user.password = make_password(new_password)
    user.save(using=db_name)

    return JsonResponse({"status": "success", "message": "تم تغيير كلمة المرور بنجاح"})
