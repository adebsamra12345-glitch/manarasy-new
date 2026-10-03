from django.urls import path
from . import views

urlpatterns = [
    path('geocode/', views.geocode_api, name='geocode_api'),
    path('reverse/', views.reverse_geocode_api, name='reverse_geocode_api'),
]
