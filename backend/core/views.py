from django.http import JsonResponse


def health_check(request):
    """
    Lightweight, unauthenticated health check probe for Railway container lifecycle monitoring.
    Returns HTTP 200 with minimal JSON without requiring database access or exposing
    internal infrastructure details.
    """
    return JsonResponse({"status": "ok"})
