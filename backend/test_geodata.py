import urllib.request
import urllib.parse
import json
import time

def test_apis():
    print("Testing Geocoding API...")
    query = urllib.parse.quote("دمشق")
    url = f"http://localhost:8000/api/geodata/geocode/?query={query}"
    
    # First request
    start = time.time()
    try:
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
            print(f"First request took: {(time.time() - start) * 1000:.2f} ms")
            if not data:
                print("Warning: No data returned from Geocoding API")
            else:
                print(f"Success! Found: {data[0].get('display_name')}")
    except Exception as e:
        print(f"Error calling Geocoding API: {e}")
        return

    # Second request (Cache hit)
    start = time.time()
    try:
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
            time_taken = (time.time() - start) * 1000
            print(f"Second request (Cache) took: {time_taken:.2f} ms")
            if time_taken < 100:
                print("Cache is working perfectly!")
    except Exception as e:
        print(f"Error calling Geocoding API (Cache): {e}")

if __name__ == "__main__":
    test_apis()
