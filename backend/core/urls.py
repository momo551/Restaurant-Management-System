"""
URL configuration for Restaurant Management System.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from users.views import LogoutView, CustomTokenObtainPairView
from rest_framework_simplejwt.views import (
    TokenRefreshView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    # JWT Authentication
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/logout/', LogoutView.as_view(), name='logout'),
    # API endpoints
    path('api/tenants/', include('tenants.urls')),
    path('api/users/', include('users.urls')),
    path('api/menu/', include('menu.urls')),
    path('api/tables/', include('tables.urls')),
    path('api/orders/', include('orders.urls')),
    path('api/billing/', include('billing.urls')),
    path('api/reports/', include('reports.urls')),
    path('api/stock/', include('stock.urls')),
    path('api/loyalty/', include('loyalty.urls')),
    path('api/public/', include('orders.public_urls')),
]

# Serve media files in development only.
# In production, configure Nginx or django-storages (S3/Cloudflare R2) instead.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
