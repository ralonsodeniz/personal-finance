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
A source-owned financial resource such as a bank account, brokerage account,
pension plan, or term deposit. It is the boundary at which balances,
activities, holdings, and valuations belong; it is not an authentication
identity.
_Avoid_: User account, login account

**Resource**:
A typed financial object that belongs to one Workspace and may have explicitly
defined child resources.
_Avoid_: Record, item

## Investment tracking

**Instrument**:
An identifiable financial product or asset that can be held or valued, such as
a fund, ETF, ETC, or security. Its identity is independent of any one
provider's symbol or label.
_Avoid_: Ticker, provider product

**Activity**:
A dated economic event that changes a Financial Account or explains its income,
cost, tax, transfer, or corporate action. Contributions, trades, distributions,
fees, taxes, and transfers are Activities, not interchangeable transaction
labels.
_Avoid_: Transaction, movement

**Holding**:
A current or as-of quantity or value of an Instrument within a Financial
Account. A Holding may be derived from Activities or supported by a source
snapshot when activity history is incomplete.
_Avoid_: Position, when it means the whole account

**Lot**:
The remaining portion of an acquired Holding together with its acquisition date,
basis, currency, and lineage. A Lot is evidence for basis and gain reporting,
not a substitute for a Holding.
_Avoid_: Unqualified cost basis

**Valuation**:
A dated observation of an account or Holding's value, quantity, or price,
including its source and quality. A missing or stale Valuation is an explicit
data state, not zero.
_Avoid_: Current value without an as-of date

**Valuation quality**:
The status of a Valuation, such as confirmed, estimated, stale, missing, or
manually overridden. It tells a report whether a displayed value is complete
and current enough for its intended use.
_Avoid_: Price status

**Reporting Portfolio**:
A saved, read-only reporting scope over selected Financial Accounts. It groups
data for analysis without owning, copying, or duplicating the underlying
balances.
_Avoid_: Investment account, ledger

**Import Batch**:
A group of source rows or provider records processed together with their
source, mapping, review, and outcome. It preserves provenance for manual and
imported Activities.
_Avoid_: Upload

**Provenance**:
The source and history that explain a financial record, including where it came
from, when it was observed, and how it was corrected or transformed.
_Avoid_: Metadata

**Reconciliation**:
A comparison between the app's financial records and external source evidence,
such as a statement or account snapshot. It records the degree of agreement and
any discrepancy without silently changing the underlying records.
_Avoid_: Auto-correction

**Correction**:
A new linked record that reverses or supersedes an earlier record while
retaining the original and the reason. Corrections preserve the history of what
was imported or entered.
_Avoid_: Edit, when history matters

**External flow**:
Money or value entering or leaving the selected reporting scope, such as a
contribution or withdrawal. A transfer between two in-scope Financial Accounts
is an Internal Transfer instead.
_Avoid_: Deposit, when scope is unclear

**Internal Transfer**:
A movement of money or an Instrument between Financial Accounts included in the
same Reporting Portfolio. It is not investment performance at that scope.
_Avoid_: Contribution

**Corporate Action**:
An issuer or plan event that changes an Instrument, its quantity, or its basis,
such as a split, merger, spin-off, rights issue, or liquidation. It preserves
lineage and is not assumed to be an ordinary buy or sell.
_Avoid_: Trade

**Book Cost**:
Economic capital committed to an asset, tracked separately from a tax
calculation. Its meaning includes the source and policy used to derive it.
_Avoid_: Tax basis

**Tax Basis**:
Basis used for a stated tax jurisdiction and account wrapper. It may be unknown
or estimated when source history is incomplete, and it is not a promise of tax
filing or advice.
_Avoid_: Unqualified cost

**Reporting Currency**:
The currency in which a Reporting Portfolio presents values. Activities and
Valuations retain their native amounts and dated conversion evidence.
_Avoid_: Base currency, when it hides conversion policy

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
