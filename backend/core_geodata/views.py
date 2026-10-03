import json
import urllib.parse
import urllib.request
from django.http import JsonResponse
from django.core.cache import cache
from django.views.decorators.http import require_http_methods

@require_http_methods(["GET"])
def geocode_api(request):
    query = request.GET.get("query", "")
    if not query:
        return JsonResponse([], safe=False)

    cache_key = f"geo:query:{query}"
    cached_data = cache.get(cache_key)
    
    if cached_data:
        return JsonResponse(json.loads(cached_data), safe=False)

    try:
        url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(query)}&format=json&addressdetails=1&accept-language=ar&limit=5"
        req = urllib.request.Request(url, headers={'User-Agent': 'ManarasyApp/1.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            cache.set(cache_key, json.dumps(data), timeout=30*24*60*60) # 30 Days
            return JsonResponse(data, safe=False)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@require_http_methods(["GET"])
def reverse_geocode_api(request):
    lat = request.GET.get("lat")
    lon = request.GET.get("lon")
    if not lat or not lon:
        return JsonResponse({'error': 'Missing lat or lon'}, status=400)

    cache_key = f"geo:reverse:{lat}:{lon}"
    cached_data = cache.get(cache_key)
    
    if cached_data:
        return JsonResponse(json.loads(cached_data), safe=False)

    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=18&addressdetails=1&accept-language=ar"
        req = urllib.request.Request(url, headers={'User-Agent': 'ManarasyApp/1.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            cache.set(cache_key, json.dumps(data), timeout=30*24*60*60) # 30 Days
            return JsonResponse(data, safe=False)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
