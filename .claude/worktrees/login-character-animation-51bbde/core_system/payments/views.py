import json
import traceback
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from core_system.subscriptions.models import Subscription
from .models import PaymentTransaction

def parse_body(request):
    if not request.body:
        return {}
    try:
        return json.loads(request.body.decode('utf-8'))
    except json.JSONDecodeError:
        raise ValueError("صيغة البيانات غير صالحة")

@csrf_exempt
def payment_list_create_view(request):
    print("\n==========================================")
    print(f"[START] Payments API (core_system.payments): Method={request.method}")
    print("==========================================")
    
    if request.method == 'GET':
        try:
            print("  [STEP 1] Querying payment transactions...")
            txs = PaymentTransaction.objects.select_related('subscription').all().order_by('-created_at')
            print(f"  [STEP 2] Found {txs.count()} transaction(s).")
            
            res = []
            for tx in txs:
                res.append({
                    "id": str(tx.id),
                    "subscription_id": str(tx.subscription.id),
                    "amount": str(tx.amount),
                    "currency": tx.currency,
                    "payment_method": tx.payment_method,
                    "transaction_id": tx.transaction_id,
                    "status": tx.status,
                    "created_at": tx.created_at.isoformat()
                })
            print(f"[RESULT] Successfully returned {len(res)} payment transactions.")
            return JsonResponse({"status": "success", "count": len(res), "data": res}, status=200)

        except Exception as e:
            print(f"[ERROR] Failed to query payments: {str(e)}")
            print(traceback.format_exc())
            return JsonResponse({"status": "error", "message": "حدث خطأ أثناء جلب الدفعات", "details": str(e)}, status=500)

    elif request.method == 'POST':
        try:
            print("  [STEP 1] Parsing payload for payment creation...")
            data = parse_body(request)
            
            print("  [STEP 2] Validating payload fields (subscription_id, amount)...")
            if not data.get('subscription_id') or not data.get('amount'):
                return JsonResponse({"status": "error", "message": "subscription_id و amount مطلوبان"}, status=400)

            print(f"  [STEP 3] Validating Subscription ID: {data['subscription_id']}")
            sub = Subscription.objects.get(id=data['subscription_id'])
            
            print("  [STEP 4] Recording Payment Transaction...")
            tx = PaymentTransaction.objects.create(
                subscription=sub,
                amount=data['amount'],
                currency=data.get('currency', 'USD'),
                payment_method=data.get('payment_method', 'SHAM_CASH'),
                transaction_id=data.get('transaction_id'),
                status=data.get('status', 'PENDING')
            )
            
            print(f"  [STEP 5] Transaction created successfully with ID={tx.id}")
            return JsonResponse({
                "status": "success",
                "message": "تم تسجيل دفعة جديدة بنجاح",
                "data": {
                    "id": str(tx.id),
                    "amount": str(tx.amount),
                    "status": tx.status,
                    "created_at": tx.created_at.isoformat()
                }
            }, status=201)

        except Subscription.DoesNotExist:
            print(f"[ERROR] Subscription {data.get('subscription_id')} does not exist.")
            return JsonResponse({"status": "error", "message": "الاشتراك المرتبط غير موجود"}, status=404)

        except Exception as e:
            print(f"[ERROR] Payment recording failed: {str(e)}")
            print(traceback.format_exc())
            return JsonResponse({"status": "error", "message": "حدث خطأ عند تسجيل الدفعة", "details": str(e)}, status=500)

    else:
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

@csrf_exempt
def sham_cash_webhook_view(request):
    print("\n==========================================")
    print(f"[START] Sham Cash Webhook: Method={request.method}")
    print("==========================================")
    
    if request.method == 'POST':
        try:
            print("  [STEP 1] Receiving Sham Cash callback payload...")
            data = parse_body(request)
            
            tx_id = data.get('transaction_id')
            status = data.get('status', 'SUCCESS')
            print(f"  [STEP 2] Callback received for TxID={tx_id}, status={status}")
            
            if tx_id:
                try:
                    tx = PaymentTransaction.objects.get(transaction_id=tx_id)
                    tx.status = status
                    tx.save()
                    print(f"  [STEP 3] Updated payment transaction {tx.id} status to {status}")
                except PaymentTransaction.DoesNotExist:
                    print(f"  [WARNING] Transaction ID {tx_id} not matched in DB")

            print(f"[RESULT] Sham Cash Webhook processed successfully.")
            return JsonResponse({
                "status": "success",
                "message": "تمت معالجة إشعار بوابة شام كاش بنجاح"
            }, status=200)

        except Exception as e:
            print(f"[ERROR] Sham Cash Webhook processing failed: {str(e)}")
            print(traceback.format_exc())
            return JsonResponse({"status": "error", "message": "فشل معالجة إشعار شام كاش", "details": str(e)}, status=500)
    else:
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)
