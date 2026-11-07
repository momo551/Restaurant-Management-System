import re

from rest_framework import serializers

from .models import CONTENT_SCHEMA, Testimonial, WebsiteSettings, merge_content

_COLOR_OK = re.compile(r'^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$')


def validate_content_payload(value):
    """Validate a draft/published content dict against CONTENT_SCHEMA."""
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise serializers.ValidationError('يجب أن يكون المحتوى كائن JSON.')

    cleaned = {}
    unknown = [k for k in value.keys() if k not in CONTENT_SCHEMA]
    if unknown:
        raise serializers.ValidationError(
            {'content': f'حقول غير مدعومة: {", ".join(sorted(unknown))}'}
        )

    for key, raw in value.items():
        kind, max_len = CONTENT_SCHEMA[key]
        if kind == 'bool':
            if not isinstance(raw, bool):
                raise serializers.ValidationError({'content': f'الحقل {key} يجب أن يكون true/false.'})
            cleaned[key] = raw
        elif kind == 'color':
            if not isinstance(raw, str) or not _COLOR_OK.match(raw.strip()):
                raise serializers.ValidationError(
                    {'content': f'قيمة اللون {key} غير صالحة. استخدم تنسيق #RRGGBB.'}
                )
            cleaned[key] = raw.strip().lower()
        else:
            if not isinstance(raw, str):
                raise serializers.ValidationError({'content': f'الحقل {key} يجب أن يكون نصاً.'})
            text = raw.strip()
            if max_len and len(text) > max_len:
                raise serializers.ValidationError(
                    {'content': f'الحقل {key} يتجاوز الحد الأقصى ({max_len} حرف).'}
                )
            cleaned[key] = text
    return cleaned


class WebsiteSettingsSerializer(serializers.ModelSerializer):
    restaurant_slug = serializers.CharField(source='restaurant.slug', read_only=True)
    restaurant_name = serializers.CharField(source='restaurant.name', read_only=True)
    logo = serializers.ImageField(required=False, allow_null=True)
    hero_image = serializers.ImageField(required=False, allow_null=True)
    content = serializers.JSONField(required=False)

    class Meta:
        model = WebsiteSettings
        fields = [
            'id', 'restaurant', 'restaurant_slug', 'restaurant_name',
            'logo', 'hero_image', 'content',
            'is_published', 'published_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'restaurant', 'is_published', 'published_at', 'created_at', 'updated_at']

    def validate_content(self, value):
        return validate_content_payload(value)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['content'] = merge_content(instance.content)
        data['published_content'] = instance.get_published_content() if instance.is_published else None
        return data


class TestimonialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Testimonial
        fields = [
            'id', 'restaurant', 'author_name', 'text', 'rating',
            'is_published', 'display_order', 'source',
            'created_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'restaurant', 'source', 'created_by', 'created_at', 'updated_at']

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError('التقييم يجب أن يكون بين 1 و 5.')
        return value

    def validate_text(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('نص الرأي مطلوب.')
        if len(value) > 1000:
            raise serializers.ValidationError('نص الرأي طويل جداً (الحد الأقصى 1000 حرف).')
        return value

    def validate_author_name(self, value):
        value = (value or '').strip()
        if not value:
            raise serializers.ValidationError('اسم العميل المعروض مطلوب.')
        if len(value) > 120:
            raise serializers.ValidationError('الاسم طويل جداً (الحد الأقصى 120 حرف).')
        return value


class PublicTestimonialSerializer(serializers.ModelSerializer):
    """Minimal public representation — no internal ids or staff references."""

    class Meta:
        model = Testimonial
        fields = ['id', 'author_name', 'text', 'rating', 'display_order']
