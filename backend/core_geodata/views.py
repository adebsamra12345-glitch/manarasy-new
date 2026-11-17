import json
import urllib.parse
import urllib.request
from django.http import JsonResponse
from django.core.cache import cache
from django.views.decorators.http import require_http_methods
from rest_framework.throttling import BaseThrottle

def _is_rate_limited(request, scope, max_requests=60, window_sec=60):
    ip = BaseThrottle().get_ident(request) or 'anonymous'
    key = f"geolimit:{scope}:{ip}"
    count = cache.get(key, 0)
    if count >= max_requests:
        return True
    cache.set(key, count + 1, window_sec)
    return False

@require_http_methods(["GET"])
def geocode_api(request):
    query = request.GET.get("query", "")
    if _is_rate_limited(request, 'search', 60, 60):
        return JsonResponse({'error': 'تم تجاوز معدل الطلبات المسموح به مؤقتاً'}, status=429)

    query = (request.GET.get("query") or "").strip()[:100]
    if not query:
        return JsonResponse([], safe=False)

    cache_key = f"geo:query:{query}"
    cached_data = cache.get(cache_key)
    
    if cached_data:
        return JsonResponse(json.loads(cached_data), safe=False)

    try:
        url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(query)}&format=json&addressdetails=1&accept-language=ar&limit=5"
        req = urllib.request.Request(url, headers={'User-Agent': 'ManarasyApp/1.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            cache.set(cache_key, json.dumps(data), timeout=30*24*60*60) # 30 Days
            return JsonResponse(data, safe=False)
    except Exception as e:
        return JsonResponse({'error': 'فشل البحث الجغرافي'}, status=500)

@require_http_methods(["GET"])
def reverse_geocode_api(request):
    if _is_rate_limited(request, 'reverse', 60, 60):
        return JsonResponse({'error': 'تم تجاوز معدل الطلبات المسموح به مؤقتاً'}, status=429)

    raw_lat = request.GET.get("lat")
    raw_lon = request.GET.get("lon")
    if not raw_lat or not raw_lon:
        return JsonResponse({'error': 'Missing lat or lon'}, status=400)

    cache_key = f"geo:reverse:{lat}:{lon}"
    try:
        lat = float(raw_lat)
        lon = float(raw_lon)
        if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
            return JsonResponse({'error': 'إحداثيات غير صالحة'}, status=400)
    except (ValueError, TypeError):
        return JsonResponse({'error': 'إحداثيات غير صالحة'}, status=400)

    cache_key = f"geo:reverse:{lat:.5f}:{lon:.5f}"
    cached_data = cache.get(cache_key)
    
    if cached_data:
        return JsonResponse(json.loads(cached_data), safe=False)

    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=18&addressdetails=1&accept-language=ar"
        req = urllib.request.Request(url, headers={'User-Agent': 'ManarasyApp/1.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode())
            cache.set(cache_key, json.dumps(data), timeout=30*24*60*60) # 30 Days
            return JsonResponse(data, safe=False)
    except Exception as e:
        return JsonResponse({'error': 'فشل تحديد الموقع الجغرافي'}, status=500)
