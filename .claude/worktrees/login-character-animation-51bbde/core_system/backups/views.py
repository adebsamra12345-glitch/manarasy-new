import json
import traceback
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core_system.tenants.models import Tenant
from .models import BackupLog

def parse_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        raise ValueError("بيانات غير صالحة")

@csrf_exempt
def backup_list_create_view(request):
    print("\n==========================================")
    print(f"[START] Backups API (core_system.backups): Method={request.method}")
    print("==========================================")
    
    if request.method == 'GET':
        try:
            print("  [STEP 1] Querying backup logs from DB...")
            backups = BackupLog.objects.select_related('tenant').all().order_by('-created_at')
            print(f"  [STEP 2] Found {backups.count()} backup log(s).")
            
            res = []
            for b in backups:
                res.append({
                    "id": str(b.id),
                    "tenant_id": str(b.tenant.id),
                    "tenant_name": b.tenant.name,
                    "file_url": b.file_url,
                    "size_bytes": b.size_bytes,
                    "status": b.status,
                    "created_at": b.created_at.isoformat()
                })
            print(f"[RESULT] Successfully fetched {len(res)} backup record(s).")
            return JsonResponse({"status": "success", "count": len(res), "data": res}, status=200)

        except Exception as e:
            print(f"[ERROR] Failed to query backups: {str(e)}")
            print(traceback.format_exc())
            return JsonResponse({"status": "error", "message": "فشل استرجاع سجلات النسخ الاحتياطي", "details": str(e)}, status=500)

    elif request.method == 'POST':
        try:
            print("  [STEP 1] Parsing payload for Backup creation...")
            data = parse_body(request)
            
            if not data.get('tenant_id') or not data.get('file_url'):
                return JsonResponse({"status": "error", "message": "tenant_id و file_url مطلوبان"}, status=400)

            print(f"  [STEP 2] Validating Tenant ID: {data['tenant_id']}")
            tenant = Tenant.objects.get(id=data['tenant_id'])
            
            print("  [STEP 3] Recording Backup Log...")
            backup = BackupLog.objects.create(
                tenant=tenant,
                file_url=data['file_url'],
                size_bytes=data.get('size_bytes', 0),
                status=data.get('status', 'COMPLETED')
            )
            
            print(f"  [STEP 4] Backup log saved successfully with ID={backup.id}")
            return JsonResponse({
                "status": "success",
                "message": "تم تسجيل ملف النسخة الاحتياطية بنجاح",
                "data": {
                    "id": str(backup.id),
                    "tenant_name": tenant.name,
                    "file_url": backup.file_url,
                    "status": backup.status,
                    "created_at": backup.created_at.isoformat()
                }
            }, status=201)

        except Tenant.DoesNotExist:
            print(f"[ERROR] Tenant {data.get('tenant_id')} not found.")
            return JsonResponse({"status": "error", "message": "المستأجر غير موجود"}, status=404)

        except Exception as e:
            print(f"[ERROR] Backup log recording failed: {str(e)}")
            print(traceback.format_exc())
            return JsonResponse({"status": "error", "message": "حدث خطأ عند تسجيل النسخة الاحتياطية", "details": str(e)}, status=500)

    else:
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)
