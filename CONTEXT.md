# Personal Finance

This context covers people, financial data ownership, household collaboration,
and selected-resource sharing in the personal-finance platform.

## Identity and financial data

**User**:
A person with an application identity who may own personal data and participate
in one or more workspaces.
_Avoid_: Account, customer

**Identity**:
A login identity belonging to a User and used to establish who is acting in the
application.
_Avoid_: Login, account

**Financial Account**:
A financial-domain resource such as a bank, brokerage, cash, or investment
account; it is not an authentication identity.
_Avoid_: User account, login account

**Resource**:
A typed financial object that belongs to one Workspace and may have explicitly
defined child resources.
_Avoid_: Record, item

## Collaboration

**Workspace**:
A collaboration boundary containing financial resources and memberships. A
Workspace is either personal or household in the initial model.
_Avoid_: Tenant, account

**Personal Workspace**:
The private default Workspace created for a User. It has one owner in the
initial model and is not merged with or converted into another Workspace in v1.
_Avoid_: Personal account

**Household**:
A collaborative Workspace for people who intentionally share access to its
financial resources.
_Avoid_: Household account

**Membership**:
A User's relationship to a Workspace, including role and current membership
status.
_Avoid_: Permission, invitation

**Household membership scope**:
The role-defined access a User receives through an active Household Membership;
v1 does not create a separate per-member resource allowlist.

**Additive access**:
The union of all valid access paths for a User, such as household membership and
an individual Resource Grant; revoking one path does not remove another valid
path.

**Owner**:
A Membership role with full authority over the Workspace, including membership,
role, grant, and ownership-management actions.

**Editor**:
A Membership role that can read and change permitted Workspace resources but
cannot manage members, roles, grants, or deletion in v1.

**Viewer**:
A Membership role that can read permitted Workspace resources but cannot change
resources or manage collaboration.

## Scoped sharing

**Resource Grant**:
An explicit, authenticated, view-only permission for a selected Resource and its
approved descendants, granted to an individual User. Workspace-to-workspace
resource grants are deferred beyond v1.
_Avoid_: Public link, role claim

**Invitation**:
A single-use, expiring mechanism that helps an intended person authenticate and
establish a Resource Grant; it is not a permanent bearer link to financial data.
_Avoid_: Anonymous link, share URL

**Revocation**:
The removal of current access to a Membership or Resource Grant. Revocation is
effective for subsequent authorization checks even if a provider token remains
valid.
_Avoid_: Token refresh, logout

**Resource inheritance**:
Access flowing from a parent Resource to explicitly approved descendants only.
It never implies access to siblings, the whole Workspace, or unrelated reports.
_Avoid_: Recursive access, broad sharing

**Resource-level authorization**:
The decision about whether a User may access a particular Resource or approved
descendant at all.

**Field visibility**:
The decision about which details inside an authorized Resource may be shown;
the finance-domain session defines this separately from resource access.

**Step-up authentication**:
A recent or stronger authentication check required before high-impact actions
such as sharing, ownership transfer, export, or account deletion.
_Avoid_: Re-login everywhere
