import json
import traceback
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core_system.tenants.models import Tenant
from .models import Plan, Subscription

def parse_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        raise ValueError("صيغة البيانات في الطلب غير صالحة (Invalid JSON)")

@csrf_exempt
def plan_list_view(request):
    print("\n==========================================")
    print(f"[START] Plans API (core_system.subscriptions): Method={request.method}")
    print("==========================================")
    
    if request.method == 'GET':
        try:
            print("  [STEP 1] Querying available Subscription Plans...")
            plans = Plan.objects.filter(is_active=True)
            print(f"  [STEP 2] Found {plans.count()} active plan(s).")
            
            data = []
            for p in plans:
                data.append({
                    "id": p.id,
                    "name": p.name,
                    "code": p.code,
                    "billing_cycle": p.billing_cycle,
                    "price_usd": str(p.price_usd),
                    "has_ai_features": p.has_ai_features,
                    "is_active": p.is_active
                })
            
            print(f"[RESULT] Successfully fetched {len(data)} plan(s).")
            return JsonResponse({
                "status": "success",
                "message": "تم استرجاع قائمة خطط الاشتراك بنجاح",
                "count": len(data),
                "data": data
            }, status=200)

        except Exception as e:
            print(f"[ERROR] Failed to fetch plans: {str(e)}")
            print(traceback.format_exc())
            return JsonResponse({
                "status": "error",
                "message": "حدث خطأ أثناء استرجاع خطط الاشتراك",
                "details": str(e)
            }, status=500)
    else:
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

@csrf_exempt
def subscription_list_create_view(request):
    print("\n==========================================")
    print(f"[START] Subscriptions API (core_system.subscriptions): Method={request.method}")
    print("==========================================")
    
    if request.method == 'GET':
        try:
            print("  [STEP 1] Fetching all Subscriptions...")
            subs = Subscription.objects.select_related('tenant', 'plan').all().order_by('-created_at')
            print(f"  [STEP 2] Found {subs.count()} subscription record(s).")
            
            res = []
            for s in subs:
                res.append({
                    "id": str(s.id),
                    "tenant_id": str(s.tenant.id),
                    "tenant_name": s.tenant.name,
                    "plan_name": s.plan.name,
                    "plan_code": s.plan.code,
                    "status": s.status,
                    "starts_at": s.starts_at.isoformat(),
                    "ends_at": s.ends_at.isoformat(),
                    "auto_renew": s.auto_renew,
                    "created_at": s.created_at.isoformat()
                })
                
            print(f"[RESULT] Subscriptions query executed successfully ({len(res)} items)")
            return JsonResponse({
                "status": "success",
                "message": "تم جلب قائمة الاشتراكات بنجاح",
                "count": len(res),
                "data": res
            }, status=200)

        except Exception as e:
            print(f"[ERROR] Subscriptions query failed: {str(e)}")
            print(traceback.format_exc())
            return JsonResponse({
                "status": "error",
                "message": "خطأ أثناء استرجاع قائمة الاشتراكات",
                "details": str(e)
            }, status=500)

    elif request.method == 'POST':
        try:
            print("  [STEP 1] Parsing payload for Subscription creation...")
            data = parse_body(request)
            
            print("  [STEP 2] Validating payload fields...")
            required = ['tenant_id', 'plan_id', 'starts_at', 'ends_at']
            for f in required:
                if not data.get(f):
                    print(f"  [ERROR] Validation error: Field '{f}' is required.")
                    return JsonResponse({
                        "status": "error",
                        "message": f"الحقل {f} مطلوب لتسجيل الاشتراك",
                        "details": f"Field '{f}' is missing"
                    }, status=400)

            print(f"  [STEP 3] Validating Tenant ({data['tenant_id']}) and Plan ({data['plan_id']})...")
            tenant = Tenant.objects.get(id=data['tenant_id'])
            print(tenant)
            plan = Plan.objects.get(id=data['plan_id'])
            
            print("  [STEP 4] Saving Subscription to DB...")
            sub = Subscription.objects.create(
                tenant=tenant,
                plan=plan,
                status=data.get('status', 'ACTIVE'),
                starts_at=data['starts_at'],
                ends_at=data['ends_at'],
                auto_renew=data.get('auto_renew', True)
            )
            
            print(f"  [STEP 5] Subscription ID={sub.id} created successfully.")
            result = {
                "id": str(sub.id),
                "tenant_name": tenant.name,
                "plan_name": plan.name,
                "status": sub.status,
                "starts_at": sub.starts_at,
                "ends_at": sub.ends_at
            }
            print(f"[RESULT] Subscription created successfully for Tenant: {tenant.name}")
            return JsonResponse({
                "status": "success",
                "message": "تم إضافة الاشتراك بنجاح",
                "data": result
            }, status=201)

        except (Tenant.DoesNotExist, Plan.DoesNotExist) as e:
            print(f"[ERROR] Referenced Tenant or Plan not found: {str(e)}")
            return JsonResponse({
                "status": "error",
                "message": "المستأجر أو خطة الاشتراك غير موجودة في النظام",
                "details": str(e)
            }, status=404)

        except ValueError as e:
            print(f"[ERROR] Value error: {str(e)}")
            return JsonResponse({"status": "error", "message": str(e)}, status=400)

        except Exception as e:
            print(f"[ERROR] Subscription creation failed: {str(e)}")
            print(traceback.format_exc())
            return JsonResponse({
                "status": "error",
                "message": "حدث خطأ عند إضافة الاشتراك",
                "details": str(e)
            }, status=500)

    else:
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)
