"""
URL configuration for growl project.

The API is mounted under `/api/` and nothing else is exposed. There is no browsable HTML API
in production, and there is deliberately no payout endpoint: no member and no group admin can
reach a payout instruction through this surface. P-S1, P-S7.

JWT is issued by SimpleJWT at `/api/auth/token/`. Access tokens are short lived and refresh
tokens rotate with reuse detection, so a stolen refresh token is usable at most once and its
reuse revokes the whole family. I23.
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from susu.api import (
    ContributionCreateView,
    ContributionTransitionView,
    CurrentRoundView,
    GroupAuditFeedView,
    GroupListView,
    RoundDetailView,
)

urlpatterns = [
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    path("api/groups/", GroupListView.as_view(), name="group-list"),
    path("api/groups/<int:group_id>/rounds/current/", CurrentRoundView.as_view(),
         name="current-round"),
    path("api/groups/<int:group_id>/audit/", GroupAuditFeedView.as_view(),
         name="group-audit"),

    path("api/rounds/<int:round_id>/", RoundDetailView.as_view(), name="round-detail"),
    path("api/rounds/<int:round_id>/contributions/", ContributionCreateView.as_view(),
         name="contribution-create"),
    path("api/contributions/<int:pk>/<str:transition>/", ContributionTransitionView.as_view(),
         name="contribution-transition"),
]