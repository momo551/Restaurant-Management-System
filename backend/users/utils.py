from .models import ActivityLog
from django.contrib.contenttypes.models import ContentType

class LoggingMixin:
    """Mixin to automatically log CRUD actions in ActivityLog."""
    
    def perform_create(self, serializer):
        instance = serializer.save()
        self._log_action('create', instance)
        return instance

    def perform_update(self, serializer):
        instance = serializer.save()
        self._log_action('update', instance)
        return instance

    def perform_destroy(self, instance):
        self._log_action('delete', instance)
        instance.delete()

    def _log_action(self, action_type, instance):
        try:
            user = self.request.user
            if not user.is_authenticated:
                user = None
                
            model_name = instance._meta.model_name
            object_id = instance.pk if hasattr(instance, 'pk') else None
            
            # Basic description
            description = f"{action_type.capitalize()}d {model_name}"
            if hasattr(instance, '__str__'):
                description += f": {str(instance)}"
                
            ActivityLog.objects.create(
                user=user,
                action=action_type,
                model_name=model_name,
                object_id=object_id,
                description=description,
                ip_address=self.request.META.get('REMOTE_ADDR')
            )
        except Exception as e:
            # We don't want logging failure to break the main request
            print(f"Logging error: {str(e)}")
