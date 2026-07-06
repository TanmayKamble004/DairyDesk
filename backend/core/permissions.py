"""Role-based permissions (spec section 4: staff cannot see financial data)."""
from rest_framework.permissions import BasePermission

from .models import User


class IsOwner(BasePermission):
    """Allows access only to users with the 'owner' role."""

    message = "Only the owner can access financial data."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and getattr(request.user, "role", None) == User.Role.OWNER
        )
