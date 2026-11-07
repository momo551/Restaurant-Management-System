from django.conf import settings
from django.db import models
from django.utils import timezone


# Editable content keys for the customer-facing website. The draft lives in
# `WebsiteSettings.content` (JSON) and is validated key-by-key by the serializer;
# publishing snapshots it into `published_content` so the public site only ever
# sees explicitly published values.
DEFAULT_CONTENT = {
    'display_name': '',
    'hero_title': 'طعم يأخذك لعالم آخر',
    'hero_subtitle': 'استمتع بأشهى المأكولات المحضرة بكل حب واتقان. اطلب الآن واستلم طلبك في أسرع وقت.',
    'hero_cta_text': 'تصفح المنيو',
    'hero_secondary_text': 'تتبع طلبك',
    'primary_color': '#e04a4a',
    'secondary_color': '#f97316',
    'background_color': '#ffffff',
    'text_color': '#111827',
    'phone': '',
    'whatsapp': '',
    'address': '',
    'footer_text': '',
    'show_testimonials': True,
}

# key -> (kind, max_length). 'color' values must be #rgb or #rrggbb.
CONTENT_SCHEMA = {
    'display_name': ('str', 120),
    'hero_title': ('str', 200),
    'hero_subtitle': ('str', 500),
    'hero_cta_text': ('str', 80),
    'hero_secondary_text': ('str', 80),
    'primary_color': ('color', 7),
    'secondary_color': ('color', 7),
    'background_color': ('color', 7),
    'text_color': ('color', 7),
    'phone': ('str', 30),
    'whatsapp': ('str', 30),
    'address': ('str', 300),
    'footer_text': ('str', 500),
    'show_testimonials': ('bool', None),
}


def merge_content(raw):
    """Return a complete content dict: schema defaults overlaid with stored values.

    Extra keys (e.g. ``logo_url``/``hero_image_url`` written at publish time) are
    preserved; draft writes are already restricted to CONTENT_SCHEMA by the
    serializer/view before they reach storage.
    """
    merged = dict(DEFAULT_CONTENT)
    if isinstance(raw, dict):
        merged.update(raw)
    return merged


class WebsiteSettings(models.Model):
    """Per-restaurant customer website settings with draft/publish workflow."""

    restaurant = models.OneToOneField(
        'tenants.Restaurant',
        on_delete=models.CASCADE,
        related_name='website_settings',
        verbose_name='المطعم',
    )
    logo = models.ImageField(upload_to='website/', blank=True, null=True, verbose_name='الشعار')
    hero_image = models.ImageField(upload_to='website/', blank=True, null=True, verbose_name='صورة الغلاف')
    content = models.JSONField(default=dict, blank=True, verbose_name='مسودة المحتوى')
    published_content = models.JSONField(null=True, blank=True, verbose_name='المحتوى المنشور')
    is_published = models.BooleanField(default=False, verbose_name='منشور')
    published_at = models.DateTimeField(null=True, blank=True, verbose_name='تاريخ آخر نشر')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')

    class Meta:
        verbose_name = 'إعدادات الموقع'
        verbose_name_plural = 'إعدادات المواقع'

    def __str__(self):
        return f'إعدادات موقع {self.restaurant.name}'

    def get_draft_content(self):
        return merge_content(self.content)

    def get_published_content(self):
        if self.published_content:
            return merge_content(self.published_content)
        return merge_content(None)


class Testimonial(models.Model):
    """Admin-curated testimonial shown on the customer website.

    These are NOT real customer-submitted reviews: `source` records where the
    entry came from so the UI/API can label them honestly.
    """

    class Source(models.TextChoices):
        ADMIN_ADDED = 'admin_added', 'أُضيفت من إدارة المطعم'
        IMPORTED = 'imported', 'مستوردة'

    restaurant = models.ForeignKey(
        'tenants.Restaurant',
        on_delete=models.CASCADE,
        related_name='website_testimonials',
        verbose_name='المطعم',
    )
    author_name = models.CharField(max_length=120, verbose_name='اسم العميل المعروض')
    text = models.TextField(max_length=1000, verbose_name='نص الرأي')
    rating = models.PositiveSmallIntegerField(default=5, verbose_name='التقييم (1-5)')
    is_published = models.BooleanField(default=False, verbose_name='منشور')
    display_order = models.PositiveIntegerField(default=0, verbose_name='ترتيب العرض')
    source = models.CharField(
        max_length=30,
        choices=Source.choices,
        default=Source.ADMIN_ADDED,
        verbose_name='المصدر',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='website_testimonials',
        verbose_name='أُضيف بواسطة',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='تاريخ الإنشاء')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='تاريخ التحديث')

    class Meta:
        verbose_name = 'رأي عميل'
        verbose_name_plural = 'آراء العملاء'
        ordering = ['display_order', '-created_at']

    def __str__(self):
        return f'{self.author_name} ({self.restaurant.name})'
