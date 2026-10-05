from django.urls import path

from .views import PlatformLoginView, PlatformLogoutView, PlatformMeView

urlpatterns = [
    path('login/', PlatformLoginView.as_view(), name='platform_login'),
    path('me/', PlatformMeView.as_view(), name='platform_me'),
    path('logout/', PlatformLogoutView.as_view(), name='platform_logout'),
]
