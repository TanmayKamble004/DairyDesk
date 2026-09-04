"""Role-based permissions (spec section 4: staff cannot see financial data)."""
from rest_framework.permissions import BasePermission

from .models import User


def is_owner(user):
    """True when `user` is an authenticated owner-role user.

    Shared by the permission class, the dashboard's KPI gating and the
    serializers that hide cost data, so the role check lives in one place.
    """
    return bool(
        user
        and user.is_authenticated
        and getattr(user, "role", None) == User.Role.OWNER
    )


class IsOwner(BasePermission):
    """Allows access only to users with the 'owner' role."""

    message = "Only the owner can access financial data."

    def has_permission(self, request, view):
        return is_owner(request.user)


class CanManageStaff(IsOwner):
    """The same rule, worded for the one owner-only surface that isn't money."""

    message = "Only the owner can manage staff accounts."
