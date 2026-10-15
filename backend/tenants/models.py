from django.db import models
import uuid


class Restaurant(models.Model):
    """
    Central tenant model. Every piece of restaurant-specific data must trace
    back to one Restaurant record.

    Design notes:
    - `slug` is URL-safe, used for public customer-facing endpoints (e.g. QR menus).
    - `uuid` is an opaque identifier that can be shared with external systems.
    - `is_active` lets a system admin suspend a tenant without deleting their data.
    - Fields kept minimal intentionally — SaaS/billing/branch fields will be added
      in a later phase once the multi-tenant foundation is proven.
    """

    uuid = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
        verbose_name='معرف فريد (UUID)',
        help_text='معرف خارجي ثابت للمطعم، مفيد للـ API والتكاملات الخارجية.'
    )
    name = models.CharField(max_length=200, verbose_name='اسم المطعم')
    slug = models.SlugField(
        max_length=100,
        unique=True,
        verbose_name='المعرف النصي (Slug)',
        help_text='معرف نصي للاستخدام في الروابط العامة، مثل "cairo-branch".'
    )
    phone = models.CharField(max_length=30, blank=True, verbose_name='رقم الهاتف')
    address = models.TextField(blank=True, verbose_name='العنوان')
    is_active = models.BooleanField(
        default=True,
        verbose_name='نشط',
        help_text='إلغاء التفعيل يوقف وصول موظفي هذا المطعم دون حذف البيانات.'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')

    class Meta:
        verbose_name = 'مطعم'
        verbose_name_plural = 'المطاعم'
        ordering = ['name']

    def __str__(self):
        return self.name
