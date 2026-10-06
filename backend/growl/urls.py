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

from compliance.api import (
    ConsentView,
    MyDataView,
    PrivacyRequestDetailView,
    PrivacyRequestListCreateView,
    PublicNoticeView,
)
from susu.api import (
    ContributionCreateView,
    ContributionTransitionView,
    CurrentRoundView,
    GroupAuditFeedView,
    GroupCreateView,
    GroupJoinView,
    GroupListView,
    RoundDetailView,
)

urlpatterns = [
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),

    path("api/groups/", GroupCreateView.as_view(), name="group-list"),
    path("api/groups/", GroupCreateView.as_view(), name="group-create"),
    path("api/groups/join/", GroupJoinView.as_view(), name="group-join"),
    path("api/groups/<int:group_id>/rounds/current/", CurrentRoundView.as_view(),
         name="current-round"),
    path("api/groups/<int:group_id>/audit/", GroupAuditFeedView.as_view(),
         name="group-audit"),

    path("api/rounds/<int:round_id>/", RoundDetailView.as_view(), name="round-detail"),
    path("api/rounds/<int:round_id>/contributions/", ContributionCreateView.as_view(),
         name="contribution-create"),
    path("api/contributions/<int:pk>/<str:transition>/", ContributionTransitionView.as_view(),
         name="contribution-transition"),

    # Act 843. The notice is public because s.27(2) requires it *before* collection, which is
    # a moment no authenticated request can reach. Everything else is the caller's own data only.
    path("api/privacy/notice/", PublicNoticeView.as_view(), name="privacy-notice"),
    path("api/privacy/export/", MyDataView.as_view(), name="privacy-export"),
    path("api/privacy/consent/", ConsentView.as_view(), name="privacy-consent"),
    path("api/privacy/requests/", PrivacyRequestListCreateView.as_view(), name="privacy-requests"),
    path("api/privacy/requests/<int:request_id>/", PrivacyRequestDetailView.as_view(),
         name="privacy-request-detail"),
]