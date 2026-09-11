# DairyDesk — Dairy Business Management System
## Comprehensive Project & Technical Documentation

*A Field-Study Based System for Mumbai's Dairy Retail Sector*

**Document version:** 1.0
**Date:** 7 September 2026
**Repository:** `DairyDesk` (private)
**Status of the software described:** Demo v1 (MVP cut, per `PROJECT_SPEC.md`)

---

### About this document

This document consolidates and completes the project report *Dairy Business Management
System* (Chapters 1–3) and extends it with the technical documentation required to run,
operate, extend and maintain the software: architecture, technology stack, implemented
data models, API reference, business logic, deployment, user guide, developer guide,
troubleshooting and a full bibliography.

Two conventions are used throughout:

- **Report content (Chapters 1–3)** is preserved from the original project report. Where
  the implementation has moved ahead of the report, the additional material is marked
  with a *Note added in this revision* callout rather than by rewriting the original text.
- **Implementation status** is marked on every feature and module as
  **Implemented**, **Partial**, or **Deferred**, verified on 7 September 2026 against both
  the source tree and the **running application** — the full test suite was executed
  (97/97 pass) and every documented API contract was called live (see Chapter 13,
  Validation Report).

All diagrams referenced in Chapter 3 are reproduced unchanged from the original report.
Diagrams that the implementation has outgrown are listed in §13.6 with recommendations,
but **no diagram has been altered**.

---

## Table of Contents

**Part I — Project Report**
- [Chapter 1: Introduction](#chapter-1-introduction)
  - [1.1 Background](#11-background)
  - [1.2 Problem Statement](#12-problem-statement)
  - [1.3 Purpose of Project](#13-purpose-of-project)
  - [1.4 Objectives of Project](#14-objectives-of-project)
  - [1.5 Scope of Project](#15-scope-of-project)
- [Chapter 2: Literature Survey](#chapter-2-literature-survey)
  - [2.1 CaptainBiz Dairy Management Software](#21-system-name-captainbiz-dairy-management-software)
  - [2.2 Vyapar](#22-system-name-vyapar)
  - [2.3 Marg ERP](#23-system-name-marg-erp)
  - [2.4 Zoho Inventory](#24-system-name-zoho-inventory)
  - [2.5 Technology Overview](#25-technology-overview)
  - [2.6 Comparison Summary](#26-comparison-summary)
- [Chapter 3: System Requirements and Design](#chapter-3-system-requirements-and-design)
  - [3.1 System Modules](#31-system-modules)
  - [3.2 Hardware and Software Requirements](#32-hardware-and-software-requirements)
  - [3.3 Planning and Scheduling](#33-planning-and-scheduling)
  - [3.4 Conceptual Models](#34-conceptual-models)

**Part II — Technical Documentation**
- [Chapter 4: System Architecture](#chapter-4-system-architecture)
- [Chapter 5: Technology Stack](#chapter-5-technology-stack)
- [Chapter 6: Data Models (As Implemented)](#chapter-6-data-models-as-implemented)
- [Chapter 7: API Reference](#chapter-7-api-reference)
- [Chapter 8: Business Logic](#chapter-8-business-logic)
- [Chapter 9: Deployment and Configuration](#chapter-9-deployment-and-configuration)
- [Chapter 10: User Guide](#chapter-10-user-guide)
- [Chapter 11: Developer Guide](#chapter-11-developer-guide)
- [Chapter 12: Troubleshooting](#chapter-12-troubleshooting)
- [Chapter 13: Validation Report](#chapter-13-validation-report)
  - [13.1 Verification Summary](#131-verification-summary) · [13.1.1 Test Suite Execution](#1311-test-suite-execution) · [13.1.2 Live API Verification](#1312-live-api-verification) · [13.1.3 Confirmed Runtime Versions](#1313-confirmed-runtime-versions)
  - [13.2 Discrepancies](#132-discrepancies-between-the-report-and-the-implementation) · [13.3 Observations](#133-implementation-observations-not-report-discrepancies)
  - [13.4 Documented but Not Implemented](#134-features-documented-but-not-implemented) · [13.5 Implemented but Not Documented](#135-features-implemented-but-not-documented-in-the-report)
  - [13.6 Diagrams Awaiting Approval](#136-diagrams-that-may-need-changes--awaiting-your-approval) · [13.7 Assumptions](#137-assumptions-made)
- [Bibliography](#bibliography)
- [Appendix A: Environment Variable Reference](#appendix-a-environment-variable-reference)
- [Appendix B: Seeded Demo Data](#appendix-b-seeded-demo-data)
- [Appendix C: Glossary](#appendix-c-glossary)

---
---

# Part I — Project Report

# Chapter 1: Introduction

## 1.1 Background

The dairy industry plays a crucial role in meeting the daily nutritional needs of urban
populations, and this is especially true in a city as large and densely populated as
Mumbai. Mumbai's dairy market is highly competitive and operates at significant scale,
with large organised players such as Amul actively expanding their distribution networks
across the city and putting pressure on smaller, local dairy retailers to remain efficient
and reliable [16]. In a market of this size, where dairy products are purchased and
delivered in high volumes every single day, proper inventory control, timely order
processing, accurate billing, and regulatory record maintenance become essential to
staying in business.

However, a large number of local dairy outlets in Mumbai still depend on manual registers,
handwritten notebooks, and basic spreadsheets to manage their daily operations. This
traditional approach creates several recurring problems, including product spoilage, stock
imbalance, missed subscriptions, delayed deliveries, billing mistakes, and weak
decision-making, all of which stem from a lack of real-time, centralised information.
Because dairy products such as milk, curd, and paneer are highly perishable, even small
operational delays in identifying near-expiry stock or processing an order can lead
directly to wastage and financial loss. Industry-focused inventory solutions for the dairy
sector have shown that digitising stock tracking, expiry monitoring, and billing can
substantially reduce these inefficiencies [17].

A Dairy Business Management System, built specifically for the needs of a Mumbai-based
dairy retailer, can help solve these problems by automating stock updates, billing, order
handling, delivery scheduling, and record keeping. This not only improves day-to-day
efficiency and reduces human error, but also gives the business owner the real-time
visibility needed to compete and grow in Mumbai's fast-moving and increasingly organised
dairy market.

## 1.2 Problem Statement

The current working style of many dairy shops in Mumbai, as observed during the field study
and survey conducted for this project, is still largely manual and fragmented. Inventory is
tracked using physical notebooks or basic registers, bills are prepared by hand at the
counter, customer subscriptions for regular home delivery are maintained separately on
paper or in the shopkeeper's memory, and the status of deliveries is checked informally
rather than through any structured system.

Because of this fragmented approach, several operational issues arise on a regular basis.
Spoilage of perishable stock often goes unnoticed until the product has already expired,
since there is no automated tracking of expiry dates. Stock levels become inaccurate
because sales and incoming stock are not reconciled in real time, and customers
occasionally receive late, incomplete, or incorrect orders due to the absence of a formal
order-tracking process. Billing errors and missed entries further affect the shop's revenue
and damage customer trust over time. In addition, the owner or manager lacks access to
consolidated, up-to-date information that would help them make informed decisions about
restocking, demand patterns, pricing, and regulatory compliance.

There is, therefore, a clear and pressing need for a centralised, IT-based Dairy Business
Management System that can digitise these daily activities and provide a single, reliable
platform for managing inventory, billing, customer orders, deliveries, and business
records.

## 1.3 Purpose of Project

The existing manual system used by Mumbai's local dairy retailers suffers from several
limitations, and the proposed system is designed to directly address each of them:

| # | Problem | Solution |
|---|---------|----------|
| 1 | Stock registers are maintained on paper, making it difficult to know exact quantities at any given time. | The system replaces manual stock registers with automated, real-time inventory tracking. |
| 2 | Perishable products often expire unnoticed, leading to wastage. | The system monitors expiry dates continuously and generates automatic alerts before stock goes bad. |
| 3 | Bills are handwritten, leading to calculation mistakes and inconsistent records. | The system generates accurate, computerised bills and invoices automatically based on orders. |
| 4 | Customer subscriptions and daily delivery schedules are tracked informally, causing missed or delayed deliveries. | The system manages subscriptions, orders, and delivery schedules digitally and in an organised manner. |
| 5 | Business and compliance records are scattered across notebooks and receipts, making audits and reporting difficult. | The system maintains all compliance and business records securely in digital form for quick reference and reporting. |
| 6 | Owners lack consolidated data to make timely business decisions. | The system supports better decision-making through dashboards and automatically generated reports. |

> **Note added in this revision.** Of the six purposes above, (1), (2), (3) and (6) are
> realised in the current build. Purpose (4) is realised for one-time orders and order
> status tracking, but not for recurring subscriptions. Purpose (5) is deferred — see
> §1.5.2 and §13.4.

## 1.4 Objectives of Project

1. To develop a centralised system for managing dairy inventory, customer records, orders,
   and billing in a single platform.
2. To reduce product spoilage and wastage by tracking expiry dates and monitoring
   perishable stock levels in real time.
3. To improve order and delivery accuracy through structured, digital scheduling of
   customer subscriptions and daily deliveries.
4. To minimise billing errors and revenue leakage by automating invoice generation and
   payment tracking.
5. To support better, faster business decisions by providing the owner with consolidated
   dashboards and reports on stock, sales, and dues.

> **Note added in this revision — measurable acceptance criteria.** The objectives above
> are validated in the current build against the following criteria, all of which are
> covered by the automated test suite (`backend/core/tests.py`, 97 tests):
>
> | Obj. | Acceptance criterion | Verified by |
> |------|----------------------|-------------|
> | 1 | Products, stock batches, suppliers, customers, orders and invoices are all reachable from one authenticated API and one web client. | `Chapter 7` endpoint inventory |
> | 2 | Every batch is classified fresh / ageing / expired from its expiry date, with no manual step; expired stock is excluded from available quantity. | `StockBatch.expiry_status`, `Product.available_quantity` |
> | 3 | An order cannot be created for more stock than exists, and its status advances only along `pending → processed → delivered`. | `deduct_stock_fifo`, `ORDER_STATUS_TRANSITIONS` |
> | 4 | Marking an order delivered raises exactly one invoice, numbered uniquely and never reused. | `ensure_invoice`, `next_invoice_number` |
> | 5 | The owner's dashboard shows stock value, ageing/expired counts, today's orders and sales, and unpaid invoice count; staff see the non-financial subset. | `DashboardView` |

## 1.5 Scope of Project

### 1.5.1 Features

The features of the proposed system, listed in the chronological order in which a dairy
shop would typically use them during daily operations, are as follows:

| # | Feature | Status |
|---|---------|--------|
| 1 | User login with secure JWT-based authentication and role-based access for owner and staff. | **Implemented** |
| 2 | Product and stock management, including adding new stock on arrival. | **Implemented** |
| 3 | Expiry date monitoring and automatic alert generation for ageing stock. | **Implemented** |
| 4 | Customer registration and subscription management for regular delivery customers. | **Partial** — registration implemented; subscriptions deferred |
| 5 | Order placement and delivery scheduling for daily and one-time orders, with order status tracked from pending to processed to delivered. | **Partial** — one-time orders and status tracking implemented; scheduling deferred |
| 6 | Automated billing and invoice generation once an order is fulfilled. | **Implemented** |
| 7 | Payment tracking and management of pending customer dues. | **Partial** — invoice `paid_amount` / `status` are modelled and displayed; no API to record a payment |
| 8 | Dashboard with live KPI tiles and an interactive 3D inventory shelf visualisation, plus report generation for stock, sales, and business performance. | **Partial** — KPIs and 3D shelf implemented against live data; the Reports page renders from local demo data |
| 9 | Record maintenance for compliance and audit purposes. | **Deferred** |

> **Note added in this revision — features delivered beyond the original scope.** The
> following were built after the report was written and are fully implemented. They are
> documented in Chapters 3, 6, 7 and 8.
>
> | # | Feature | Status |
> |---|---------|--------|
> | 10 | Supplier master: create, edit, list and delete wholesale suppliers, with contact, rating and last-order tracking. | **Implemented** |
> | 11 | Reorder levels per product (`reorder_threshold`, `reorder_quantity`) and a derived low / out-of-stock indicator. | **Implemented** |
> | 12 | Automatic purchase-order generation when stock falls to the reorder threshold, with duplicate suppression and automatic closure on receipt of stock. | **Implemented** |
> | 13 | Staff management: an owner can add, edit, enable/disable and reset passwords for people who can sign in. | **Implemented** |
> | 14 | Alerts page consolidating out-of-stock, low-stock, overstock, ageing and expired conditions with a recommended action for each. | **Implemented** |
> | 15 | Product catalogue enrichment: SKU, description and an optional product photograph. | **Implemented** |
> | 16 | Sequential, year-scoped invoice numbering (`INV-<year>-<sequence>`). | **Implemented** |
> | 17 | Cost confidentiality: batch purchase price and all financial KPIs are withheld from staff accounts. | **Implemented** |

### 1.5.2 Exclusions

The following items are outside the scope of the current version of the project but may be
considered for future enhancement:

- Native mobile application development in the first version.
- AI-based demand forecasting in the initial release.
- IoT-based cold storage integration.
- ERP integration with large enterprise systems.
- Online milk production or farm management features.

> **Note added in this revision — additional deferrals confirmed in the build.** The
> following were also left out of Demo v1 and are recorded here so the scope statement
> matches the software: recurring subscriptions and automatic order generation from them;
> a separate `Payment` entity and an endpoint to record payments; a distinct `Delivery`
> entity (delivery is folded into `Order.status`); server-side, date-ranged reporting
> (the Reports page is a client-side CSV export over demo data); and the compliance and
> document-storage module.

---

# Chapter 2: Literature Survey

To understand what solutions are already available in the market, the following existing
systems were studied. CaptainBiz was the primary reference system for the field study;
three widely used Indian retail and inventory platforms are surveyed alongside it so the
positioning of this project is clear.

> **Note on figures.** Pricing and adoption figures quoted below were current at the time
> of the survey and are attributed to the vendors' own published pages. They should be
> re-verified before being used in any commercial comparison.

## 2.1 System Name: CaptainBiz Dairy Management Software

CaptainBiz offers inventory management software designed specifically for dairy businesses.
The platform focuses on perishable stock control, expiry date tracking, automated billing,
and compliance-oriented record keeping for dairy retailers and distributors [17]. It serves
as a useful reference model for this project because it demonstrates, in a real commercial
product, how digital tools can reduce manual errors, prevent stock wastage, and support
more efficient day-to-day dairy operations — the same core problems identified during the
Mumbai field study.

**Feature list.** Based on the reviewed system, the key features that inform the design of
this project include [17]:

- Inventory tracking for perishable products.
- Expiry date monitoring and alerts.
- Automated billing and invoicing.
- Sales and stock reporting.
- Secure business record maintenance.
- Support for scalable dairy operations.

**Technology overview.** Cloud-hosted, browser-delivered, subscription-priced, with a
relational data store behind a web application tier [17].

## 2.2 System Name: Vyapar

Vyapar is a popular Indian billing and accounting application aimed at small businesses.
It generates GST and non-GST invoices, manages inventory and tracks payments, and is
available on Android, Windows and the web [18].

**Features** [19]:

- GST and non-GST invoice generation.
- Inventory management with low-stock alerts.
- Customer and supplier ledgers.
- Expense tracking and profit-and-loss reports.
- Barcode scanning.
- Cloud sync across devices.

**Technology overview** [18], [20]:

- Platform: Android (primary), Windows desktop, web.
- Backend: cloud-based, with an offline mode.
- Pricing: free basic plan; paid plans from ₹3,399/year.

**Relevance to this project.** Vyapar demonstrates the value of low-stock alerting and a
supplier ledger for a small retailer — both of which this project implements (§8.3) — but
it is generic retail software with no notion of a perishable batch or an expiry date, which
is precisely the gap DairyDesk addresses.

## 2.3 System Name: Marg ERP

Marg ERP is one of India's longest-established business management products, in the market
since 1992 and used by more than two lakh businesses for retail billing, distribution and
manufacturing. It is a Windows desktop application sold under a one-time licence [21].

**Features** [22]:

- Complete billing with GST compliance.
- Inventory and stock management with **batch tracking**.
- Barcode generation and scanning.
- Customer and vendor account management.
- Financial reports and balance sheets.
- Multi-location branch management.

**Technology overview** [21], [23]:

- Platform: Windows desktop.
- Backend: desktop client–server architecture.
- Pricing: one-time licence from ₹9,000.

**Relevance to this project.** Marg ERP validates batch-level stock tracking as the correct
model for perishables — the same decision taken here (§6.3) — but its enterprise feature
surface and Windows-only client are heavier than a single-counter dairy shop needs.

## 2.4 System Name: Zoho Inventory

Zoho Inventory is a cloud-based inventory management product by Zoho Corporation. It tracks
stock levels, manages sales and purchase orders and handles billing, and connects with Zoho
Books for accounting [24].

**Features** [25]:

- Real-time inventory tracking across warehouses.
- Order management (sales and purchase orders).
- Batch and serial number tracking.
- Low-stock alerts and reorder points.
- Integration with shipping carriers.
- Reports and dashboards for inventory analysis.
- Multi-channel selling.

**Technology overview** [24], [26]:

- Platform: web-based.
- Backend: cloud (Java-based).
- Database: cloud PostgreSQL.
- Pricing: free plan (up to 50 orders/month); paid plans from ₹2,999/month.

**Relevance to this project.** Zoho Inventory's *reorder point* concept is the direct
antecedent of this project's auto-reorder rule (§8.3). Its dependence on a live internet
connection and a recurring subscription is the constraint a small dairy shop feels most.

## 2.5 Technology Overview

The literature and industry examples reviewed indicate that dairy management software is
generally built using a web-based architecture, consisting of a user-friendly front end, a
backend service layer, and a relational database for storing products, orders, billing, and
customer records [17]. Such an architecture is well suited to small and mid-sized dairy
shops because it can run on low-cost hardware while still offering centralised data access,
faster billing at the counter, and tighter control over stock and deliveries compared to
manual registers.

For this project, a simple and responsive front end, a secure backend API, and a relational
database are chosen because together they offer reliability, ease of use for non-technical
shop staff, and room for future expansion as the business grows. The concrete selections
and the reasoning behind each are set out in Chapter 5.

## 2.6 Comparison Summary

| Capability | CaptainBiz | Vyapar | Marg ERP | Zoho Inventory | **DairyDesk (ours)** |
|---|---|---|---|---|---|
| Per-batch expiry tracking | Yes | No | Yes | Yes | **Yes** |
| Automatic fresh / ageing / expired classification | Yes | No | Partial | Partial | **Yes** |
| FIFO stock deduction on sale | Not stated | No | Yes | Yes | **Yes** |
| 3D visual stock shelf | No | No | No | No | **Yes** |
| Automatic purchase-order reorder | Not stated | No | Yes | Yes | **Yes** |
| Role-based cost-price confidentiality | Not stated | No | Yes | Partial | **Yes** |
| Automatic invoice on delivery | Yes | Yes | Yes | Yes | **Yes** |
| Runs entirely on local infrastructure | No | Partial | Yes | No | **Yes** |
| Subscription fee | Yes | Yes | No (one-time) | Yes | **No** |
| GST-compliant invoicing | Yes | Yes | Yes | Yes | **No** (deferred) |
| Barcode scanning | Not stated | Yes | Yes | Yes | **No** (deferred) |
| Native mobile app | Yes | Yes | No | Yes | **No** (deferred) |
| Recurring subscription deliveries | Yes | No | No | No | **No** (deferred) |

The comparison shows the intended position of this project: not a competitor to a
full-featured commercial ERP, but a focused, locally-hosted system that treats *perishable
batch expiry* as a first-class concern and makes stock health visible at a glance.

---

# Chapter 3: System Requirements and Design

## 3.1 System Modules

### 3.1.1 User Management Module — *Implemented*

This module is the entry point of the system and governs who can access which part of the
application.

- **Step 1:** A user enters their username and password on the login screen.
- **Step 2:** The system validates the credentials against stored, encrypted records.
- **Step 3:** Based on the user's assigned role — owner or staff — the system grants access
  only to the specific features required for that role; for example, staff may access
  inventory and order screens but not invoices or financial totals.
- **Step 4:** The system logs the session and allows the user to log out securely when
  finished.
- **Step 5:** The administrator can create, edit, or deactivate user accounts at any time.

This role-based structure improves security and prevents unauthorised actions, such as a
delivery staff member editing billing records.

> **Note added in this revision — as implemented.** Credentials are verified against a
> PBKDF2-hashed password [4] and exchanged for a JSON Web Token pair [7], [31]. Staff
> accounts are never deleted, because a person's name is attached to the orders they
> handled; they are switched off with `is_active`, which both refuses new tokens and
> invalidates tokens already issued. Two safety rules are enforced server-side: an owner
> cannot disable or demote their own account, and the last remaining active owner cannot be
> disabled or demoted by anyone. Password *resets* are a separate owner-only action
> (`POST /api/staff/{id}/set-password/`); a routine profile edit can never carry a
> password. See §7.3 and §8.6.

### 3.1.2 Inventory Management Module — *Implemented*

This module is responsible for tracking all dairy products from the moment they arrive at
the shop. Stock is tracked in batches, because expiry belongs to each individual delivery of
stock rather than to a product as a whole.

- **Step 1:** When new stock arrives, staff record it as a stock batch against a product,
  entering the quantity, purchase price, expiry date, and received date; each product itself
  carries a name, category, unit (litre, kilogram, or piece), and selling price.
- **Step 2:** The system computes the total available quantity of a product as the sum of
  the quantities of its non-expired batches.
- **Step 3:** As orders are fulfilled, the system automatically deducts the sold quantity
  from the oldest non-expired batch first (first-in, first-out), keeping inventory accurate
  without manual recalculation; if available stock is insufficient, the order is blocked
  with a clear error message.
- **Step 4:** The system continuously evaluates each batch's expiry date against the current
  date and classifies the batch as fresh (more than three days to expiry), ageing (three
  days or fewer remaining), or expired, so that ageing stock can be prioritised for sale or
  discounting before it spoils.
- **Step 5:** Stock levels and expiry statuses are visible on the dashboard, including a 3D
  'inventory shelf' view in which each product appears as a stack of crates whose height
  reflects the available quantity and whose colour — green, amber, or red — reflects the
  worst expiry status among its batches.

> **Note added in this revision — precision on Step 3.** In the implementation the FIFO
> deduction happens at the moment the **order is created**, not later when it is marked
> processed or delivered. This is deliberate: it reserves the stock for the customer as soon
> as the order is taken and makes the insufficient-stock error appear on the screen where it
> can be acted on. Batches are consumed in `received_date, expiry_date, id` order (oldest
> received first). Expired batches are never consumed. See §8.1.
>
> **Products also carry** a unique SKU, an optional description and photograph, a supplier,
> and reorder levels (`reorder_threshold`, `reorder_quantity`, `auto_reorder`). The purchase
> price on a batch is readable only by owner accounts.

### 3.1.3 Customer and Subscription Module — *Partial*

This module maintains detailed records of each customer and their delivery preferences.

- **Step 1:** A new customer is registered with their name, contact details, and address.
- **Step 2:** The customer's subscription preferences are recorded, including which products
  they receive regularly, the quantity, and the delivery frequency, such as a daily milk
  subscription.
- **Step 3:** The system stores the customer's payment status alongside their profile.
- **Step 4:** Whenever a subscription needs to be modified, paused, or cancelled, staff can
  update it directly in the customer's record.
- **Step 5:** This centralised record reduces the chances of missed or delayed deliveries
  that previously occurred when subscriptions were tracked only in the shopkeeper's memory
  or on paper.

In the current version, customer registration and records are fully implemented, while
recurring subscription schedules are planned for a future release.

> **Note added in this revision — as implemented.** Customers are created from the order
> form, which is where a new buyer first appears in practice. A customer named on any order
> cannot be deleted, so trading history is never orphaned; deletion is owner-only. Steps 2
> and 4 (subscriptions) are deferred. Step 3 is realised indirectly: payment status lives on
> the invoice rather than on the customer profile.

### 3.1.4 Order Management Module — *Implemented*

This module organises and tracks every customer order from creation to fulfilment.

- **Step 1:** An order is created by staff against a registered customer, selecting the
  products and quantities required; automatic order creation from standing subscriptions is
  planned as a future enhancement.
- **Step 2:** The system records each order line with the product, quantity, and the unit
  price captured at the moment of ordering, so that later price changes do not alter
  historical orders.
- **Step 3:** Staff update the order status as it progresses, moving it from 'pending' to
  'processed' once the items are packed, and finally to 'delivered' once it reaches the
  customer.
- **Step 4:** At each stage, the updated status is visible to relevant staff, allowing better
  coordination between the shop and delivery personnel.
- **Step 5:** Completed orders are passed automatically to the billing module for invoice
  generation.

> **Note added in this revision — as implemented.** Status transitions are validated
> server-side and are strictly forward-only: `pending → processed → delivered`. Re-submitting
> the current status is accepted as a no-op; any other move is rejected with a message naming
> the allowed flow. Orders are never deleted or edited after creation. An order must contain
> at least one line item.

### 3.1.5 Billing and Payment Module — *Partial*

This module converts completed orders into accurate financial records.

- **Step 1:** Once an order is marked as delivered, the system automatically generates its
  invoice, calculating the total amount due from the ordered quantities and the unit prices
  captured at order time.
- **Step 2:** The invoice is stored against the order and is visible to the owner; staff
  accounts cannot view invoices or financial totals.
- **Step 3:** When a customer makes a payment, the amount paid is recorded directly against
  the relevant invoice.
- **Step 4:** The system automatically tracks each invoice's status as unpaid, partially
  paid, or paid based on the amount received, so pending balances are always visible.
- **Step 5:** This automation removes the handwritten calculation errors that were common
  under the manual billing process and speeds up transactions at the counter.

> **Note added in this revision — as implemented.** Steps 1, 2 and 5 are fully implemented.
> Each invoice additionally carries a human-facing bill number of the form
> `INV-<year>-<sequence>` (for example `INV-2026-0004`), unique, never reused, and restarting
> each calendar year — this is the number a customer quotes back over the phone. Invoice
> creation is idempotent: re-confirming a delivery cannot raise a second bill.
>
> **Steps 3 and 4 are only partially realised.** `paid_amount` and `status` exist on the
> model, are returned by the API and are displayed on the Invoices page, but the invoice
> endpoint is **read-only**: there is no API action to record a payment, and no code
> recalculates `status` from `paid_amount`. In the current build a payment can only be
> entered through the Django admin interface. This is the single largest gap between the
> report and the implementation — see §13.2.

### 3.1.6 Reporting Module — *Partial*

This module converts the raw data collected by other modules into actionable business
insights.

- **Step 1:** The system continuously aggregates data on stock levels, sales,
  expiry-related losses, customer dues, and daily transactions.
- **Step 2:** At any time, the owner or manager can generate a report for a chosen date
  range or category.
- **Step 3:** Reports are presented in a clear, readable format showing key figures such as
  total sales, outstanding dues, and stock nearing expiry.
- **Step 4:** These reports allow the owner to understand business performance at a glance
  and make informed decisions about restocking, pricing, or staffing, replacing the previous
  guesswork-based approach.

In the current version, this module takes the form of a live dashboard presenting key
performance indicators — total available stock value, counts of ageing and expired products,
today's order count and sales total, and the number of unpaid invoices — alongside the 3D
inventory shelf; detailed date-range reports are planned as a future enhancement.

> **Note added in this revision — as implemented.** The dashboard is live and
> role-filtered: staff see the ageing count, expired count and today's order count; owners
> additionally see total available stock value, today's sales total and the unpaid-invoice
> count. The dashboard also renders four derived panels from the same live endpoints — stock
> by category, a seven-day order/sales series, an expiring-soon list and a recent-orders
> list — and the per-product charts respect the same financial gate (staff see counts where
> owners see rupees).
>
> A separate **Reports** page exists (owner-only) offering date-range selection, four report
> types and CSV export with RFC 4180 quoting [12]. It is **not yet wired to the API**: it
> renders from a local demo dataset (`frontend/src/data/storeMock.js`). Steps 1–4 above are
> therefore satisfied by the dashboard, not by the Reports page.

### 3.1.7 Compliance and Record Module — *Deferred*

This module ensures that all important business documentation is stored securely and remains
accessible when needed.

- **Step 1:** The system automatically stores transaction history, payment records, and stock
  movement logs as they are generated by other modules.
- **Step 2:** Important documents, such as licences or supplier agreements, can also be
  uploaded and stored digitally.
- **Step 3:** Records are organised by date and category, making it easy to retrieve specific
  information during an audit or regulatory inspection.
- **Step 4:** This digital record-keeping replaces the scattered paper-based system observed
  during the field study and supports audit readiness at all times.

This module is scoped for a future release of the system.

> **Note added in this revision.** No part of this module is built. Step 1 is partially
> satisfied as a side effect of the transactional models (orders, order items and invoices
> are immutable once written, and stock batches retain their received dates), but there is no
> document upload, no organised record browser and no audit export.

### 3.1.8 Supplier and Procurement Module — *Implemented (added in this revision)*

This module was not present in the original report. It manages the wholesale suppliers the
shop buys from, and the purchase orders raised against them.

- **Step 1:** A supplier is registered with its business name, contact person, phone, email,
  the number of products it supplies, the date of the last order placed with it, and a
  quality rating from 0.0 to 5.0.
- **Step 2:** Every product in the catalogue names the supplier it is bought from. A supplier
  that supplies any product cannot be deleted until those products are reassigned.
- **Step 3:** Each product carries a reorder threshold and a reorder quantity. When available
  stock falls to or below the threshold and the product's auto-reorder toggle is on, the
  system raises a purchase order to that product's supplier for the reorder quantity, without
  anyone asking.
- **Step 4:** Only one purchase order is outstanding per product at a time, so a run of sales
  below the threshold does not raise a stack of duplicate orders for stock already on its way.
- **Step 5:** Receiving a stock batch for that product is taken as the signal that the
  supplier delivered, and automatically closes the outstanding order as *received*, allowing
  the next reorder cycle to begin.

See §8.3 for the exact rule and §7.5 for the endpoints.

### 3.1.9 Alerts Module — *Implemented (added in this revision)*

This module was not present in the original report. It consolidates everything in the shop
that needs a person's attention onto one page, reached from the dashboard.

- **Step 1:** The system reads live product and order data and derives five alert conditions:
  out of stock, low stock (at or below the reorder threshold), overstock (more than three
  restock cycles above the reorder point — cash tied up and longer on the shelf), ageing
  stock and expired stock.
- **Step 2:** Each alert carries a recommended action. For a low or empty product the action
  takes account of any purchase order already outstanding, so an owner who has already
  ordered is not told to order again.
- **Step 3:** The same derivation feeds the dashboard's attention count, so the two screens
  can never disagree about how many things need attention.

---

## 3.2 Hardware and Software Requirements

### 3.2.1 Hardware Requirements

The following hardware is sufficient to run the DairyDesk application. The whole stack runs
in containers on a single machine; no server-class hardware is required.

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Processor | Intel Core i3 (or equivalent), 64-bit with virtualisation support | Intel Core i5, 11th generation or above |
| RAM | 4 GB | 8 GB |
| Storage | 5 GB free (container images ≈ 950 MB, plus database volume) | 512 GB SSD |
| Display | 1366 × 768 | 14-inch or 15.6-inch, 1920 × 1080 |
| Peripherals | Keyboard and mouse | Keyboard and mouse |
| Graphics | Any GPU with WebGL 2.0 support (required by the 3D inventory shelf) | Discrete or modern integrated GPU |
| Network | Required for the first build only (to pull container images and packages) | Broadband |

> **Note.** Once the images are built, the application itself runs entirely on the local
> machine and does not require an internet connection. The original report listed an
> internet connection as a requirement; this is accurate for installation and updates, not
> for day-to-day operation.

### 3.2.2 Software Requirements (Development and Deployment)

Everything below is either supplied by the container images or installed by them. See
Chapter 5 for the rationale behind each choice and Chapter 9 for the exact commands.

| Category | Technology | Version (pinned) | Purpose |
|----------|-----------|------------------|---------|
| Container runtime | Docker Desktop / Docker Engine with Compose v2 | latest | Runs the whole stack reproducibly on any machine [14], [15] |
| Version control | Git | any recent | Source control and collaboration |
| Backend language | Python | 3.13 (`python:3.13-slim`) | Backend logic and database access [1] |
| Web framework | Django | 5.1.4 | ORM, migrations, admin, routing [2] |
| API framework | Django REST Framework | 3.15.2 | Serialisation, viewsets, permissions, browsable API [3] |
| Authentication | `djangorestframework-simplejwt` | 5.4.0 | JWT access/refresh tokens [5] |
| CORS | `django-cors-headers` | 4.6.0 | Allows the Vite dev origin to call the API [6] |
| Database driver | `psycopg[binary]` | 3.2.3 | PostgreSQL adapter for Python [9] |
| Image handling | Pillow | 11.0.0 | Backs `Product.image` (Django `ImageField`) [10] |
| Configuration | `python-dotenv` | 1.0.1 | Loads `.env` in local development [11] |
| Database | PostgreSQL | 16 (`postgres:16`) | Relational store for all application data [8] |
| Frontend runtime | Node.js | 22 (`node:22-alpine`) | Runs the Vite toolchain [27] |
| Build tool | Vite | 8.1.x | Dev server with HMR, production bundling [29] |
| UI library | React | 19.2.x | Component-based user interface [28] |
| Routing | React Router | 7.18.x | Client-side routing and route guards [30] |
| HTTP client | Axios | 1.18.x | API calls, auth header and refresh interceptors [31] |
| Styling | Tailwind CSS | 4.3.x | Utility-first styling [32] |
| 3D rendering | `@react-three/fiber` 9.6.x, `@react-three/drei` 10.7.x, `three` 0.185.x | — | The 3D inventory shelf [33], [34], [35] |
| Linting | oxlint | 1.71.x | Frontend static analysis [36] |
| IDE | Visual Studio Code | latest | Development environment |
| Browser | Google Chrome or Microsoft Edge (WebGL 2.0) | latest | Runs the client |
| Operating system | Windows 10/11, macOS, or Linux | — | Host for Docker |

### 3.2.3 Software Requirements (End User)

The shop owner or counter staff need only:

- A supported web browser with WebGL 2.0 enabled.
- Network access to the machine running the application (or the same machine).
- A username and password issued by the owner.

No software is installed on the end user's machine.

---

## 3.3 Planning and Scheduling

The project follows an iterative and incremental development model. The system was
decomposed into modules — data models and administration, the REST API with JWT
authentication and role-based permissions, the React frontend, and the 3D inventory view —
and each module was designed, developed, tested, and integrated as a working increment.
Feedback from using earlier increments drove revisions to previously completed modules; for
example, the inventory module was refined after integration testing. The schedule below maps
these increments onto the overall project timeline.

### 3.3.1 GANTT Chart (Planned vs Actual)

The project began in the first week of June 2026. The Gantt chart below shows the planned
duration for each project phase alongside the actual duration taken, allowing easy
comparison and identification of any delays.

**Figure 3.1: GANTT Chart showing planned vs actual progress of the project phases**
*(reproduced unchanged from the original report; source:
`diagrams/DairyDesk_Diagrams.drawio`, page "Fig 3.1 Gantt Chart")*

> **Note added in this revision.** The chart is stamped *as of 13 July 2026*. Work has
> continued since — supplier management, auto-reorder, staff management, invoice numbering
> and the frontend restyle were all delivered after that date. The chart is **left unchanged**
> as instructed; see §13.6 for the recommended update.

---

## 3.4 Conceptual Models

### 3.4.1 ER Diagram

The Entity-Relationship diagram below illustrates the main entities of the Dairy Business
Management System and how they relate to one another.

**Figure 3.2: ER Diagram of the Dairy Business Management System**
*(reproduced unchanged; source: `diagrams/DairyDesk_Diagrams.drawio`, page "Fig 3.2 ER
Diagram"; export: `diagrams/exports/figure-3-1.png`)*

> **Note added in this revision.** The diagram documents the seven entities of the MVP cut.
> Three entities have since been added to the implementation (`Supplier`, `PurchaseOrder`,
> and additional fields on `Product` and `Invoice`). The diagram is **left unchanged** as
> instructed. The complete implemented schema is documented separately in Chapter 6, and the
> recommended diagram update is listed in §13.6.

### 3.4.2 Data Dictionary (as per Figure 3.2)

The data dictionary below provides the metadata for each entity shown in the ER diagram
above, ensuring both representations carry identical information. Payment tracking is folded
into the Invoice entity (paid amount and status) and delivery tracking into the Order status
field; separate Payment, Delivery, Subscription, and Report entities are deferred to a future
version.

| Entity | Attribute | Data Type | Description |
|--------|-----------|-----------|-------------|
| User | user_id | int | Unique user identifier (primary key) |
| User | username | varchar | Login name |
| User | password | varchar | Hashed password |
| User | role | varchar | Owner or staff |
| Product | product_id | int | Unique product identifier (primary key) |
| Product | name | varchar | Name of dairy product |
| Product | category | varchar | Product category |
| Product | unit | varchar | Litre, kilogram, or piece |
| Product | selling_price | decimal | Selling price per unit |
| StockBatch | batch_id | int | Stock batch identifier (primary key) |
| StockBatch | product_id | int | Product this batch belongs to (foreign key) |
| StockBatch | quantity | int | Quantity remaining in the batch |
| StockBatch | purchase_price | decimal | Cost price of the batch |
| StockBatch | expiry_date | date | Expiry date of this batch |
| StockBatch | received_date | date | Date the batch was received |
| Customer | customer_id | int | Unique customer identifier (primary key) |
| Customer | name | varchar | Name of customer |
| Customer | phone | varchar | Contact number |
| Customer | address | varchar | Delivery address |
| Order | order_id | int | Order identifier (primary key) |
| Order | customer_id | int | Customer who placed the order (foreign key) |
| Order | status | varchar | Pending, processed, or delivered |
| Order | created_at | datetime | Date and time the order was created |
| OrderItem | order_item_id | int | Order line identifier (primary key) |
| OrderItem | order_id | int | Parent order (foreign key) |
| OrderItem | product_id | int | Ordered product (foreign key) |
| OrderItem | quantity | int | Quantity ordered |
| OrderItem | unit_price | decimal | Selling price snapshot at order time |
| Invoice | invoice_id | int | Invoice identifier (primary key) |
| Invoice | order_id | int | Invoiced order (one-to-one foreign key) |
| Invoice | total_amount | decimal | Final bill amount |
| Invoice | paid_amount | decimal | Amount received so far |
| Invoice | status | varchar | Unpaid, partial, or paid |

> **Note added in this revision.** This dictionary is preserved exactly as written so that
> it continues to match Figure 3.2. The dictionary for the schema **as actually built** —
> including `Supplier`, `PurchaseOrder`, and the additional `Product`, `User` and `Invoice`
> columns — is given in Chapter 6.

### 3.4.3 Data Flow Diagram

**Level 0 (Context Diagram).** The Level 0 DFD shows the system as a single process
interacting with its external entities: Customer, Staff, and Owner. All of them interact
with the central Dairy Business Management System, which in turn reads from and writes to
the database to process stock, orders, billing, and reports.

**Figure 3.3: Level 0 Data Flow Diagram** *(reproduced unchanged; source page "Fig 3.3 DFD
Level 0")*

**Level 1.** The Level 1 DFD breaks the single process down into its major sub-processes:
login and access control, product and stock management, customer and order management,
billing and payment processing, and report generation.

**Figure 3.4: Level 1 Data Flow Diagram** *(reproduced unchanged; source page "Fig 3.4 DFD
Level 1")*

**Level 2.** The Level 2 DFD further decomposes the order and billing sub-processes into
individual steps: add stock, update expiry, place order, generate invoice, record payment,
and produce report.

**Figure 3.5: Level 2 Data Flow Diagram** *(reproduced unchanged; source page "Fig 3.5 DFD
Level 2")*

> **Note added in this revision.** Two flows shown in the Level 1 and Level 2 diagrams do
> not exist in the current build: *record payment* (process 4.2) has no API, and the
> supplier / purchase-order flow that the build does have is absent from the diagrams. Both
> are **left unchanged** as instructed; see §13.6.

### 3.4.4 Use Case Diagram

The use case diagram identifies three main actors — Owner, Staff, and Customer — and the key
use cases they perform within the system, including login, managing inventory, registering
customers, placing and processing orders, generating bills, updating payments, and viewing
reports.

**Figure 3.6: Use Case Diagram** *(reproduced unchanged; source page "Fig 3.6 Use Case
Diagram")*

### 3.4.5 Activity Diagram

The activity diagram below traces the main operational flow of the system, from staff login
through to final report generation.

**Figure 3.7: Activity Diagram showing the main system flow** *(reproduced unchanged; source
page "Fig 3.7 Activity Diagram")*

> **Note added in this revision.** The diagram places the FIFO deduction on the transition
> to *processed*; the implementation performs it at order **creation** (§8.1). It also shows
> a *record customer payment* step that has no API in the current build. Both are **left
> unchanged** as instructed; see §13.6.

---
---

# Part II — Technical Documentation

# Chapter 4: System Architecture

## 4.1 Architectural Style

DairyDesk is a **three-tier client–server web application** built as a decoupled
single-page application over a stateless REST API [37]:

| Tier | Responsibility | Technology |
|------|----------------|------------|
| **Presentation** | Rendering, routing, client-side state, 3D visualisation | React SPA served by Vite |
| **Application** | Business rules, validation, authorisation, serialisation | Django + Django REST Framework |
| **Data** | Durable, relational, transactional storage | PostgreSQL 16 |

The backend follows Django's **Model–View–Template** interpretation of MVC [2], with the
template layer replaced by DRF serialisers because the client renders its own views. Within
the `core` application the layering is explicit:

```
backend/core/
├── models.py        Entities, relationships, and *derived* properties
│                    (available_quantity, stock_status, expiry_status, line_total)
├── services.py      Business rules that span models and have no HTTP concerns
│                    (FIFO deduction, auto-reorder, invoice numbering)
├── serializers.py   Request/response shapes, field-level and cross-field validation,
│                    and the write-path orchestration that calls services.py
├── permissions.py   Role checks (is_owner, IsOwner, CanManageStaff)
├── views.py         HTTP surface: viewsets, custom actions, aggregation endpoints
├── urls.py          Route table (DRF DefaultRouter + explicit paths)
└── admin.py         Back-office interface over every model
```

The key architectural decision is that **business rules live in `services.py`, not in views
or in the client.** FIFO deduction, auto-reorder and invoice numbering are pure functions
over models, callable from a serialiser, a management command or a future scheduled job
without change. The frontend never computes a figure the server is responsible for.

## 4.2 Component Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser (host machine)                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  React 19 SPA  (Vite dev server :5173)                        │  │
│  │                                                               │  │
│  │   AuthContext ──► api/client.js (axios)                       │  │
│  │        │             │  request  → Authorization: Bearer …    │  │
│  │        │             │  response → 401 ⇒ single-flight refresh│  │
│  │        │             │             ⇒ retry once ⇒ else /login │  │
│  │        ▼             ▼                                        │  │
│  │   RequireAuth / RequireOwner route guards                     │  │
│  │        │                                                      │  │
│  │   Pages: Dashboard · Products · Stock Levels · Inventory ·    │  │
│  │          Orders · Suppliers · Alerts · Reports* · Invoices° · │  │
│  │          Staff°                                               │  │
│  │   Components: InventoryShelf (react-three-fiber) · Layout ·   │  │
│  │               GlassModal · Toast · charts · ui                │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │  HTTP/JSON  (CORS-allowed origin)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Django 5.1 + DRF 3.15   (gunicorn-less dev server :8000)           │
│                                                                     │
│   Middleware: Security → CORS → Session → Common → CSRF → Auth      │
│   DEFAULT_AUTHENTICATION_CLASSES: JWTAuthentication, SessionAuth    │
│   DEFAULT_PERMISSION_CLASSES:     IsAuthenticated                   │
│                                                                     │
│   ┌────────────┬──────────────┬────────────┬──────────────────┐     │
│   │  views.py  │ serializers  │ services   │  permissions     │     │
│   └────────────┴──────────────┴────────────┴──────────────────┘     │
│                          │  Django ORM                              │
│   /admin  (owner is a superuser)     /api/health/  (AllowAny)       │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  psycopg 3
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PostgreSQL 16          volume: dairydesk_pgdata                    │
└─────────────────────────────────────────────────────────────────────┘

* Reports currently renders from local demo data.
° Owner-only route.
```

## 4.3 Request Lifecycle

A representative write — *create an order* — flows as follows:

1. **Client.** `Orders.jsx` posts `{customer, items:[{product, quantity}]}` to
   `POST /api/orders/`. The axios request interceptor attaches
   `Authorization: Bearer <access>`.
2. **Authentication.** `JWTAuthentication` validates the token signature and expiry and
   resolves `request.user`. An inactive user is rejected here even if their token has not
   yet expired.
3. **Authorisation.** The global `IsAuthenticated` default applies; `OrderViewSet` adds no
   role gate, so staff may take orders.
4. **Validation.** `OrderSerializer` validates each line, rejects an empty item list, and
   resolves product IDs to model instances.
5. **Transaction.** Inside `transaction.atomic()`:
   a. `deduct_stock_fifo` locks the candidate batches with `SELECT … FOR UPDATE`, checks
      sufficiency for *every* product before writing anything, and then decrements.
   b. The `Order` row is created.
   c. `OrderItem` rows are bulk-created, each snapshotting `product.selling_price` into
      `unit_price`.
   d. `raise_auto_reorders` runs for the affected products.
   Any failure rolls the whole thing back, so a rejected order can never leave deducted
   stock or an orphan purchase order behind.
6. **Response.** `OrderSerializer` returns the order with `customer_name`, computed `total`
   and `has_invoice`.
7. **Client.** The Orders page refetches and raises a toast. A 400 is flattened into a
   readable sentence by `apiErrorMessage`.

## 4.4 Security Architecture

| Concern | Mechanism |
|---------|-----------|
| Authentication | JWT bearer tokens [7], [31]; 8-hour access, 7-day refresh; `UPDATE_LAST_LOGIN` on. Tokens are signed HS256 with `SECRET_KEY` — **the shipped default is only 22 bytes, below RFC 7518 §3.2's 32-byte minimum** [46]; see §13.2, D10 |
| Credential storage | Django's PBKDF2-SHA256 password hashing [4]; passwords are write-only in the API and never serialised back |
| Password strength | Django's four configured validators (similarity, minimum length, common-password, numeric-only) enforced on create and on reset [4] |
| Authorisation | Global `IsAuthenticated` default; `IsOwner` / `CanManageStaff` on financial and administrative surfaces; per-action gating for destructive operations |
| Financial confidentiality | `StockBatchSerializer.to_representation` strips `purchase_price` for non-owners; `DashboardView` omits monetary KPIs for staff; `/api/invoices/` and `/api/staff/` are owner-only |
| Session revocation | Disabling a user (`is_active=False`) both refuses new tokens and invalidates outstanding ones |
| Referential safety | `PROTECT` foreign keys on trading history, converted into readable 400 responses rather than 500s |
| Cross-origin | `django-cors-headers` with an explicit allow-list, default `http://localhost:5173` [6] |
| Transport | HTTP in the local demo. **Production requires TLS termination** — see §9.6 |

## 4.5 Design Decisions and Trade-offs

| Decision | Rationale | Trade-off accepted |
|----------|-----------|--------------------|
| Batch-level stock rather than a single per-product quantity | Expiry belongs to a delivery, not to a product; this is the whole point of the system | Every read of "how much do we have" is an aggregate, not a column |
| Expiry status computed, never stored | A stored status is wrong the moment the clock passes midnight | Cannot be filtered in SQL directly; the admin filter re-derives the date ranges |
| FIFO deduction at order creation | Reserves stock for the customer immediately and surfaces shortages where they can be acted on | Diverges from the activity diagram, which deducts at *processed* |
| `unit_price` snapshot on `OrderItem` | A later price change must not rewrite history | Denormalised price data |
| Invoice number separate from primary key | The customer quotes a bill number, not a database id; the sequence must restart yearly | Requires collision-retry logic on concurrent deliveries |
| Staff deactivated, never deleted | Their name is attached to past trading | `DELETE /api/staff/{id}/` deliberately returns 405 |
| One product per purchase order | Quantity comes from that product's `reorder_quantity` | A supplier with several low products receives several orders |
| Token in `localStorage` | Survives a page reload without a backend session store | Susceptible to XSS; acceptable for a local demo, not for public deployment |

---

# Chapter 5: Technology Stack

Versions below are those **declared** in `requirements.txt` and `package.json`. The versions
actually resolved inside the running containers were read back during validation and are
tabulated in §13.1.3; the backend pins resolve exactly, and only `vite` and `oxlint` sit above
their declared floor.

## 5.1 Backend

| Component | Version | Why it was chosen |
|-----------|---------|-------------------|
| **Python** [1] | 3.13 | Pinned by the container image so every developer has an identical interpreter regardless of what is installed on their machine. |
| **Django** [2] | 5.1.4 | Supplies the ORM, migrations, an authentication system with a pluggable user model, and a production-grade admin interface — the admin alone removed the need to build back-office CRUD screens for every model. |
| **Django REST Framework** [3] | 3.15.2 | Viewsets and routers give consistent, conventional REST routing; serialisers put validation next to the data shape; the permission-class system is what makes the owner/staff split declarative. |
| **djangorestframework-simplejwt** [5] | 5.4.0 | Stateless token authentication suited to an SPA client, with refresh-token rotation support and a documented extension point (`TokenObtainPairSerializer`) used here to return the user's role alongside the token pair. |
| **django-cors-headers** [6] | 4.6.0 | The client is served from a different origin (`:5173`) than the API (`:8000`) in development. |
| **psycopg** [9] | 3.2.3 (binary) | The current-generation PostgreSQL adapter; the binary wheel avoids requiring a compiler or `libpq` in the image. |
| **Pillow** [10] | 11.0.0 | Required by Django's `ImageField` for `Product.image`. |
| **python-dotenv** [11] | 1.0.1 | Loads `.env` for host-run development; the container path uses real environment variables. |

## 5.2 Frontend

| Component | Version | Why it was chosen |
|-----------|---------|-------------------|
| **React** [28] | 19.2 | Component model suits a dashboard of independently-loading panels; hooks keep data-fetching co-located with the UI that needs it. |
| **Vite** [29] | 8.1 | Near-instant dev server start and hot module replacement; a first-class Tailwind plugin. |
| **React Router** [30] | 7.18 | Nested routes let `RequireAuth` and `Layout` wrap every authenticated page once, and `RequireOwner` gate three of them. |
| **Axios** [31] | 1.18 | Interceptors are what make transparent token refresh possible in one place rather than in every call site. |
| **Tailwind CSS** [32] | 4.3 | Utility classes keep the styling next to the markup; the v4 Vite plugin needs no PostCSS configuration. |
| **@react-three/fiber** [33] | 9.6 | Renders a Three.js scene as React components, so the 3D shelf is driven by the same API state as the rest of the page rather than by imperative scene-graph code. |
| **@react-three/drei** [34] | 10.7 | Supplies `OrbitControls`, `Text` and lighting helpers, avoiding hand-written camera and label code. |
| **three** [35] | 0.185 | The underlying WebGL renderer. |
| **oxlint** [36] | 1.71 | Fast Rust-based linter; `npm run lint`. |

## 5.3 Infrastructure

| Component | Version | Why it was chosen |
|-----------|---------|-------------------|
| **PostgreSQL** [8] | 16 | Transactional integrity is load-bearing here: FIFO deduction relies on `SELECT … FOR UPDATE` row locking, and invoice numbering relies on a unique constraint plus savepoints. |
| **Docker** [14] / **Compose** [15] | v2 | One command reproduces the entire stack, pinning Python, Node and PostgreSQL versions. Follows the twelve-factor principle of configuration through the environment [13]. |
| **Node.js** [27] | 22 (Alpine) | Satisfies Vite 8's engine requirement. |

## 5.4 Patterns and Practices Applied

| Pattern / practice | Where it appears | Reference |
|--------------------|------------------|-----------|
| REST resource modelling, stateless requests | The whole `/api/` surface | [37] |
| JWT bearer authentication | `LoginView`, `api/client.js` | [7], [38] |
| Model–View–Template (Django's MVC) | Backend layering | [2] |
| Service layer separating business rules from transport | `core/services.py` | [39] |
| Repository-free active record (Django ORM) | `core/models.py` | [2], [39] |
| Twelve-factor configuration (config in the environment) | `settings.py`, `.env.example`, `docker-compose.yml` | [13] |
| Optimistic uniqueness with retry (invoice numbering) | `services.ensure_invoice` | [8] |
| Pessimistic row locking (`SELECT … FOR UPDATE`) | `services.deduct_stock_fifo` | [8], [40] |
| FIFO inventory costing and rotation | `services.deduct_stock_fifo` | [41] |
| Idempotent operations | `ensure_invoice`, order status re-submission | [37] |
| Single-flight request de-duplication | `api/client.js` refresh interceptor | — |
| Role-based access control | `core/permissions.py` | [42] |
| RFC 4180 CSV quoting | `pages/Reports.jsx` | [12] |
| Container health checks and dependency ordering | `docker-compose.yml` | [15] |

---

# Chapter 6: Data Models (As Implemented)

This chapter documents the schema **as built**, verified against `backend/core/models.py`
and the six applied migrations. It supplements — and does not replace — the data dictionary
in §3.4.2, which is preserved to match Figure 3.2.

## 6.1 Entity Overview

| Entity | Table | Purpose | In Figure 3.2? |
|--------|-------|---------|----------------|
| `User` | `core_user` | Anyone who can sign in | Yes |
| `Supplier` | `core_supplier` | Wholesale vendors the shop buys from | **No — added later** |
| `Product` | `core_product` | Catalogue item | Yes (fewer fields) |
| `StockBatch` | `core_stockbatch` | One delivery of one product, with its own expiry | Yes |
| `PurchaseOrder` | `core_purchaseorder` | Stock ordered *from* a supplier | **No — added later** |
| `Customer` | `core_customer` | Buyer | Yes |
| `Order` | `core_order` | Stock sold *to* a customer | Yes |
| `OrderItem` | `core_orderitem` | One line of an order | Yes |
| `Invoice` | `core_invoice` | The bill for a delivered order | Yes (fewer fields) |

## 6.2 Relationship Summary

```
Supplier ──1:N──► Product ──1:N──► StockBatch
    │                 │
    └──1:N──► PurchaseOrder ◄──N:1──┘

Customer ──1:N──► Order ──1:N──► OrderItem ──N:1──► Product
                    │
                    └──1:1──► Invoice

User  (standalone — no FK to transactional records in this version)
```

**Deletion behaviour**

| Relationship | On delete | Effect |
|--------------|-----------|--------|
| `Product.supplier` | `PROTECT` | A supplier with products cannot be deleted (converted to a 400) |
| `StockBatch.product` | `CASCADE` | Deleting a product would delete its batches — so the API refuses to delete a product that still has stock |
| `PurchaseOrder.supplier`, `.product` | `PROTECT` | Neither can be deleted while an order references them |
| `Order.customer` | `PROTECT` | A customer named on an order cannot be deleted (converted to a 400) |
| `OrderItem.order` | `CASCADE` | Deleting an order removes its lines |
| `OrderItem.product` | `PROTECT` | A product that has been sold cannot be deleted (converted to a 400) |
| `Invoice.order` | `CASCADE` | Deleting an order removes its invoice |

## 6.3 Field Reference

### 6.3.1 `User` (extends `AbstractUser`)

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | BigAutoField | PK | Unique user identifier |
| `username` | varchar(150) | unique, not null | Login name |
| `password` | varchar(128) | not null | PBKDF2-hashed; write-only in the API |
| `first_name` | varchar(150) | required by the API | Given name (shown on the Staff page) |
| `last_name` | varchar(150) | optional | Family name |
| `email` | email | required by the API; uniqueness enforced case-insensitively in the serialiser | Contact address |
| `role` | varchar(10) | `owner` \| `staff`, default `staff` | Determines every authorisation decision |
| `is_active` | boolean | default `true` | The off switch; also revokes issued tokens |
| `is_staff`, `is_superuser` | boolean | Django defaults | Django admin access |
| `last_login` | datetime | nullable | Updated on every token issue |
| `date_joined` | datetime | auto | Account creation time |

### 6.3.2 `Supplier`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | BigAutoField | PK | Unique supplier identifier |
| `name` | varchar(100) | required | Supplier's business name |
| `contact_person` | varchar(100) | required | Person the shop deals with |
| `phone` | varchar(20) | required | Contact number |
| `email` | email | required, format-validated | Contact address |
| `products_supplied` | positive int | required, ≥ 0 | Entered, not counted (see note) |
| `last_order_date` | date | required, not in the future | Date of the last order placed |
| `rating` | decimal(2,1) | 0.0–5.0 | Quality band shown on the Suppliers page |

*Ordering:* `name`.
*Note:* `products_supplied` is a manually entered figure retained from the standalone
inventory prototype. Now that `Product.supplier` exists it could be derived; it is not,
and the two can drift. See §13.3.

### 6.3.3 `Product`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | BigAutoField | PK | Unique product identifier |
| `name` | varchar(100) | required | Product name |
| `sku` | varchar(32) | **unique**, required; upper-cased and trimmed on write | Stock-keeping unit |
| `category` | varchar(100) | required; trimmed on write | Free-text category; the dropdown list is derived from products in use |
| `supplier` | FK → Supplier | `PROTECT`; nullable in DB, **required by the API** | Who this is bought from |
| `unit` | varchar(10) | `litre` \| `kg` \| `piece` | Unit of measure |
| `selling_price` | decimal(10,2) | required | Price charged per unit |
| `description` | text | optional | Free text |
| `image` | image | optional, `MEDIA_ROOT/products/` | Catalogue photograph |
| `reorder_quantity` | positive int | required (may be 0) | Units to order when the threshold is hit |
| `reorder_threshold` | positive int | required (may be 0) | Stock at or below this counts as low |
| `auto_reorder` | boolean | default `false` | Raise a purchase order automatically |

*Ordering:* `name`.
**Derived (read-only) properties**

| Property | Definition |
|----------|------------|
| `available_quantity` | `SUM(quantity)` over batches with `expiry_date >= today` |
| `stock_status` | `out_of_stock` if 0; `low_stock` if ≤ `reorder_threshold`; else `in_stock` |

**Cross-field validation.** `reorder_quantity`, when non-zero, must be at least
`reorder_threshold` (otherwise restocking leaves the product still low). `auto_reorder`
requires `reorder_quantity > 0`.

### 6.3.4 `StockBatch`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | BigAutoField | PK | Unique batch identifier |
| `product` | FK → Product | `CASCADE`, required | Product this batch is of |
| `quantity` | positive int | required | Units remaining in this batch |
| `purchase_price` | decimal(10,2) | required to write; **owner-only to read** | Cost price of this batch |
| `expiry_date` | date | required | When this batch expires |
| `received_date` | date | default today | When this batch arrived |

*Ordering:* `expiry_date`, `received_date`.
**Derived property** — `expiry_status`, computed against the current date:

| Value | Condition |
|-------|-----------|
| `expired` | `expiry_date < today` |
| `ageing` | `today ≤ expiry_date ≤ today + 3 days` |
| `fresh` | `expiry_date > today + 3 days` |

The three-day window is the module constant `AGEING_THRESHOLD_DAYS` in `core/models.py`.

### 6.3.5 `PurchaseOrder`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | BigAutoField | PK | Unique purchase-order identifier |
| `supplier` | FK → Supplier | `PROTECT` | Who the order is placed with |
| `product` | FK → Product | `PROTECT` | What is being ordered (one product per order) |
| `quantity` | positive int | required | Units ordered (from `product.reorder_quantity`) |
| `status` | varchar(10) | `placed` \| `received` \| `cancelled`, default `placed` | Lifecycle state |
| `auto_generated` | boolean | default `true` | False for anything raised by hand |
| `created_at` | datetime | auto | When the order was raised |

*Ordering:* `-created_at`.
*Note:* `cancelled` is defined on the model but nothing in the current build sets it.

### 6.3.6 `Customer`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | BigAutoField | PK | Unique customer identifier |
| `name` | varchar(100) | required | Customer name |
| `phone` | varchar(20) | required | Contact number |
| `address` | text | optional | Delivery address |

*Ordering:* `name`.
*Note:* `phone` is **not** unique in this implementation.

### 6.3.7 `Order`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | BigAutoField | PK | Unique order identifier |
| `customer` | FK → Customer | `PROTECT`, required | Who placed it |
| `status` | varchar(10) | `pending` \| `processed` \| `delivered`, default `pending` | Lifecycle state; read-only on create |
| `created_at` | datetime | auto | When the order was taken |

*Ordering:* `-created_at`.

### 6.3.8 `OrderItem`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | BigAutoField | PK | Unique line identifier |
| `order` | FK → Order | `CASCADE` | Parent order |
| `product` | FK → Product | `PROTECT` | Ordered product |
| `quantity` | positive int | ≥ 1 | Units ordered |
| `unit_price` | decimal(10,2) | server-assigned | Snapshot of `product.selling_price` at order time |

**Derived property** — `line_total` = `quantity × unit_price`.

### 6.3.9 `Invoice`

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | BigAutoField | PK | Unique invoice identifier |
| `order` | OneToOne → Order | `CASCADE` | The invoiced order |
| `number` | varchar(20) | **unique**, `editable=False` | Bill number, `INV-<year>-<sequence>` |
| `created_at` | datetime | auto | When the bill was raised (i.e. when the order was delivered) |
| `total_amount` | decimal(12,2) | server-computed | `Σ (quantity × unit_price)` |
| `paid_amount` | decimal(12,2) | default 0 | Amount received so far |
| `status` | varchar(10) | `unpaid` \| `partial` \| `paid`, default `unpaid` | Payment state |

*Ordering:* `-created_at, -id` (newest bill first).
*Note:* `paid_amount` and `status` are **not writable through the API** in this build; they
are set by the seed command or through the Django admin. See §13.2.

## 6.4 Migration History

| Migration | Contents |
|-----------|----------|
| `0001_initial` | User, Product, StockBatch, Customer, Order, OrderItem, Invoice |
| `0002_product_catalogue_fields` | `sku`, `description`, `image` on Product |
| `0003_supplier` | Supplier entity |
| `0004_product_supplier` | `Product.supplier` foreign key |
| `0005_auto_reorder` | `reorder_quantity`, `reorder_threshold`, `auto_reorder`, PurchaseOrder |
| `0006_invoice_number_and_date` | `Invoice.number`, `Invoice.created_at` |

---

# Chapter 7: API Reference

**Base URL:** `http://localhost:8000/api/`
**Content type:** `application/json` (product create/update also accepts
`multipart/form-data` when a photograph is attached).
**Authentication:** `Authorization: Bearer <access token>` on every endpoint except
`/api/health/` and `/api/auth/login/`.
**Default permission:** `IsAuthenticated`. Endpoints marked **Owner** additionally require
`role == "owner"`; a staff token receives `403`.

## 7.1 Conventions

| Code | Meaning |
|------|---------|
| `200` | Success (read, update, custom action) |
| `201` | Created |
| `204` | Deleted |
| `400` | Validation error — body is `{field: [messages]}` or `{"detail": "…"}` |
| `401` | Missing, malformed or expired token (the client refreshes once, then redirects to login) |
| `403` | Authenticated but not permitted (role gate) |
| `404` | No such resource |
| `405` | Method deliberately not offered (e.g. `DELETE /api/staff/{id}/`) |

Trailing slashes are **required** on every path.

## 7.2 Health and Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/health/` | None | Liveness probe → `{"status": "ok"}` |
| `POST` | `/api/auth/login/` | None | Exchange credentials for a token pair |
| `POST` | `/api/auth/refresh/` | None (refresh token in body) | Exchange a refresh token for a new access token |

**`POST /api/auth/login/`**

```jsonc
// request
{ "username": "owner", "password": "owner123" }

// 200
{
  "access":  "eyJhbGciOiJIUzI1NiIs…",   // 8-hour lifetime
  "refresh": "eyJhbGciOiJIUzI1NiIs…",   // 7-day lifetime
  "username": "owner",
  "role": "owner"                        // added by LoginSerializer for route gating
}
// 401 — bad credentials, or the account is disabled
{ "detail": "No active account found with the given credentials" }
```

**`POST /api/auth/refresh/`**

```jsonc
// request
{ "refresh": "eyJhbGciOiJIUzI1NiIs…" }
// 200
{ "access": "eyJhbGciOiJIUzI1NiIs…" }
```

## 7.3 Staff — **Owner only**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/staff/` | List everyone who can sign in (owners first, then alphabetically) |
| `POST` | `/api/staff/` | Add a person; `password` is required and write-only |
| `GET` | `/api/staff/{id}/` | Retrieve one |
| `PUT` / `PATCH` | `/api/staff/{id}/` | Edit; **cannot** carry a password |
| `POST` | `/api/staff/{id}/set-password/` | Reset a forgotten password |
| `DELETE` | `/api/staff/{id}/` | **405 — not offered by design** |

**Representation**

```jsonc
{
  "id": 3, "username": "sneha", "first_name": "Sneha", "last_name": "Patil",
  "full_name": "Sneha Patil", "email": "sneha@dairydesk.local",
  "role": "staff", "is_active": true,
  "last_login": "2026-09-07T09:12:44Z", "date_joined": "2026-08-18T05:02:11Z"
}
```

**Rules enforced**

- `password` is required on create, rejected on update, and validated against Django's four
  password validators [4]. A password that is merely the person's own username is refused.
- `email` must be unique across users (case-insensitive), though the column itself is not
  unique.
- An owner cannot disable or demote **their own** account → `400`.
- The **last active owner** cannot be disabled or demoted → `400`.

## 7.4 Products

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/products/` | Any user | List all products with derived stock figures |
| `POST` | `/api/products/` | Any user | Create; accepts `multipart/form-data` for `image` |
| `GET` | `/api/products/{id}/` | Any user | Retrieve one |
| `PUT` / `PATCH` | `/api/products/{id}/` | Any user | Update |
| `DELETE` | `/api/products/{id}/` | **Owner** | Delete, subject to the guards below |
| `GET` | `/api/products/categories/` | Any user | Distinct, sorted list of categories in use |

**Representation**

```jsonc
{
  "id": 1, "name": "Full Cream Milk", "sku": "MLK-1001", "category": "Milk",
  "supplier": 1, "supplier_name": "Sunrise Dairy Co.",
  "unit": "litre", "selling_price": "66.00",
  "description": "", "image": null,
  "reorder_quantity": 80, "reorder_threshold": 30, "auto_reorder": false,
  "open_purchase_order": null,        // or {id, quantity, supplier_name, created_at}
  "available_quantity": 65,           // derived
  "stock_status": "in_stock"          // derived: in_stock | low_stock | out_of_stock
}
```

**Write-only fields:** `clear_image` (boolean) removes a stored photograph — needed because
multipart cannot express `null`. A new upload wins over the flag: replacing is not removing.

**Deletion guards** (both return `400` with an explanatory `detail`):

- The product appears on one or more order lines — its sales history depends on it.
- The product still has units across one or more stock batches — clear the stock first.

## 7.5 Suppliers and Purchase Orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/suppliers/` | Any user | List suppliers |
| `POST` | `/api/suppliers/` | Any user | Create |
| `GET` | `/api/suppliers/{id}/` | Any user | Retrieve |
| `PUT` / `PATCH` | `/api/suppliers/{id}/` | Any user | Update |
| `DELETE` | `/api/suppliers/{id}/` | **Owner** | Delete, refused if any product names this supplier |
| `GET` | `/api/purchase-orders/` | Any user | List; filters `?product=<id>` and `?status=placed\|received\|cancelled` |
| `GET` | `/api/purchase-orders/{id}/` | Any user | Retrieve |

Purchase orders are **read-only over the API**: they are raised by the auto-reorder rule
(§8.3) and closed by receiving stock, not created by hand.

```jsonc
// supplier
{ "id": 1, "name": "Sunrise Dairy Co.", "contact_person": "Meera Kulkarni",
  "phone": "+91 98220 41220", "email": "orders@sunrisedairy.in",
  "products_supplied": 3, "last_order_date": "2026-09-06", "rating": "4.8" }

// purchase order
{ "id": 7, "supplier": 1, "supplier_name": "Sunrise Dairy Co.",
  "product": 1, "product_name": "Full Cream Milk", "quantity": 80,
  "status": "placed", "auto_generated": true,
  "created_at": "2026-09-07T06:40:12Z" }
```

Validation: `rating` must be 0.0–5.0; `last_order_date` cannot be in the future; every field
is mandatory.

## 7.6 Stock Batches

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/stock-batches/` | Any user | List batches |
| `POST` | `/api/stock-batches/` | Any user | **Receive new stock** |

```jsonc
// request
{ "product": 1, "quantity": 40, "purchase_price": "58.00",
  "expiry_date": "2026-09-12", "received_date": "2026-09-07" }

// 201 — owner
{ "id": 16, "product": 1, "product_name": "Full Cream Milk", "quantity": 40,
  "purchase_price": "58.00", "expiry_date": "2026-09-12",
  "received_date": "2026-09-07", "expiry_status": "fresh" }

// 201 — staff (purchase_price omitted entirely)
{ "id": 16, "product": 1, "product_name": "Full Cream Milk", "quantity": 40,
  "expiry_date": "2026-09-12", "received_date": "2026-09-07",
  "expiry_status": "fresh" }
```

Staff **write** `purchase_price` when receiving stock but never **read** it back — a single
`GET` would otherwise expose the margin on every product. Creating a batch also closes any
outstanding purchase order for that product (§8.3).

There is no update or delete for batches; corrections go through the Django admin.

## 7.7 Customers

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/customers/` | Any user | List |
| `POST` | `/api/customers/` | Any user | Create (from the order form) |
| `DELETE` | `/api/customers/{id}/` | **Owner** | Delete, refused if the customer is named on any order |

`{ "id": 1, "name": "Sharma General Store", "phone": "9820011223",
   "address": "Shop 4, SV Road, Andheri West, Mumbai" }`

`name` and `phone` are required; `address` is optional. There is no retrieve or update
action for customers in this build.

## 7.8 Orders

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/orders/` | Any user | List, newest first |
| `POST` | `/api/orders/` | Any user | Create an order and deduct stock (FIFO) |
| `GET` | `/api/orders/{id}/` | Any user | Retrieve |
| `PATCH` | `/api/orders/{id}/` | Any user | Advance the status; delivering raises the invoice |

**Create**

```jsonc
// request — status is read-only and always starts at "pending"
{ "customer": 1,
  "items": [ { "product": 1, "quantity": 10 }, { "product": 3, "quantity": 3 } ] }

// 201
{ "id": 12, "customer": 1, "customer_name": "Sharma General Store",
  "status": "pending", "created_at": "2026-09-07T06:55:02Z",
  "items": [
    { "id": 30, "product": 1, "product_name": "Full Cream Milk",
      "quantity": 10, "unit_price": "66.00", "line_total": "660.00" },
    { "id": 31, "product": 3, "product_name": "Dahi (Curd)",
      "quantity": 3,  "unit_price": "90.00", "line_total": "270.00" }
  ],
  "total": "930.00", "has_invoice": false }

// 400 — insufficient stock, naming every short product; nothing is deducted
{ "items": ["Insufficient stock for 'Paneer' (requested 40, available 18)."] }

// 400 — empty basket
{ "items": ["An order needs at least one item."] }
```

**Status transition**

```jsonc
// request
{ "status": "processed" }

// 400 — illegal move
{ "status": ["Cannot transition from 'pending' to 'delivered'. Allowed flow: pending -> processed -> delivered."] }
```

Allowed: `pending → processed → delivered`. Re-sending the current status is a no-op.
`PATCH {"status": "delivered"}` creates the invoice inside the same transaction and returns
the order with `has_invoice: true`. `PUT` is not offered (`405`).

## 7.9 Invoices — **Owner only**

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/invoices/` | List, newest bill first |
| `GET` | `/api/invoices/{id}/` | Retrieve |

```jsonc
{ "id": 4, "number": "INV-2026-0004", "order": 12,
  "customer_name": "Sharma General Store", "order_status": "delivered",
  "created_at": "2026-09-07T07:02:19Z",
  "total_amount": "930.00", "paid_amount": "0.00", "status": "unpaid" }
```

`number` cannot be set over the API — it is `editable=False` on the model and assigned by
`next_invoice_number`. **There is no `POST`, `PATCH` or `DELETE`,** and therefore no way to
record a payment through the API in this build.

## 7.10 Aggregation Endpoints

### `GET /api/inventory/` — the 3D shelf's data source

One row per product. Batches with `quantity == 0` are ignored entirely; expired batches are
*counted* in `batch_counts` but excluded from `available_quantity` and `nearest_expiry`.

```jsonc
[
  { "id": 1, "name": "Full Cream Milk", "category": "Milk", "unit": "litre",
    "available_quantity": 65,
    "batch_counts": { "fresh": 1, "ageing": 1, "expired": 1 },
    "worst_status": "expired",          // expired > ageing > fresh
    "nearest_expiry": "2026-09-09" }
]
```

`worst_status` drives the crate colour: `fresh` → green, `ageing` → amber, `expired` → red.
It is `null` when the product has no non-empty batches.

### `GET /api/dashboard/` — KPI tiles

The response shape **depends on the caller's role**.

```jsonc
// owner
{ "total_available_stock_value": "38420.00",   // non-expired stock at selling price
  "products_ageing_count": 4,
  "products_expired_count": 3,
  "todays_order_count": 2,
  "todays_sales_total": "1830.00",
  "unpaid_invoice_count": 1 }

// staff — the three monetary keys are absent, not null
{ "products_ageing_count": 4,
  "products_expired_count": 3,
  "todays_order_count": 2 }
```

Note that `total_available_stock_value` is computed at **selling** price, not cost.

## 7.11 Endpoint Index

| Path | GET | POST | PUT/PATCH | DELETE | Owner-only |
|------|-----|------|-----------|--------|-----------|
| `/api/health/` | ✓ (public) | — | — | — | — |
| `/api/auth/login/` | — | ✓ (public) | — | — | — |
| `/api/auth/refresh/` | — | ✓ (public) | — | — | — |
| `/api/staff/` | ✓ | ✓ | — | — | ✓ |
| `/api/staff/{id}/` | ✓ | — | ✓ | 405 | ✓ |
| `/api/staff/{id}/set-password/` | — | ✓ | — | — | ✓ |
| `/api/products/` | ✓ | ✓ | — | — | — |
| `/api/products/{id}/` | ✓ | — | ✓ | ✓ | delete only |
| `/api/products/categories/` | ✓ | — | — | — | — |
| `/api/suppliers/` | ✓ | ✓ | — | — | — |
| `/api/suppliers/{id}/` | ✓ | — | ✓ | ✓ | delete only |
| `/api/purchase-orders/` | ✓ | — | — | — | — |
| `/api/purchase-orders/{id}/` | ✓ | — | — | — | — |
| `/api/stock-batches/` | ✓ | ✓ | — | — | — |
| `/api/customers/` | ✓ | ✓ | — | — | — |
| `/api/customers/{id}/` | — | — | — | ✓ | delete only |
| `/api/orders/` | ✓ | ✓ | — | — | — |
| `/api/orders/{id}/` | ✓ | — | PATCH only | — | — |
| `/api/invoices/` | ✓ | — | — | — | ✓ |
| `/api/invoices/{id}/` | ✓ | — | — | — | ✓ |
| `/api/inventory/` | ✓ | — | — | — | — |
| `/api/dashboard/` | ✓ | — | — | — | role-filtered |

DRF's **browsable API** is enabled: opening any endpoint in a browser renders an interactive
HTML form, with session login at `/api-auth/login/`.

---

# Chapter 8: Business Logic

Every rule in this chapter lives in `backend/core/services.py` or in the serialiser that
calls it, and every one is covered by the test suite.

## 8.1 FIFO Stock Deduction

**Where:** `services.deduct_stock_fifo`, called from `OrderSerializer.create`.
**When:** at order **creation**, inside `transaction.atomic()`.

```
1. Combine the requested lines by product, so two lines for the same
   product are checked and deducted as one figure.

2. For each product:
     a. Lock its candidate batches:
          expiry_date >= today  AND  quantity > 0
        ordered by  received_date, expiry_date, id
        with SELECT … FOR UPDATE
     b. If SUM(quantity) < requested, record a shortage and continue
        (so the error names EVERY short product, not just the first).
     c. Otherwise plan the take from each batch in order until satisfied.

3. If ANY shortage was recorded → raise ValidationError. Nothing is written.

4. Only now, apply the planned decrements.
```

Three properties are load-bearing:

- **All-or-nothing.** Sufficiency is checked for every product before any row is written, so
  a five-line order that is short on line four does not half-deduct lines one to three.
- **Expired stock is never sold.** Expired batches are excluded from the candidate set, so
  they sit in the data as a visible loss rather than silently fulfilling an order.
- **Concurrency-safe.** `SELECT … FOR UPDATE` [40] serialises two simultaneous orders for
  the same product, so they cannot both pass the sufficiency check against the same units.

The caller must wrap this in a transaction; `OrderSerializer.create` does, which is also why
a failure later in order creation rolls the deduction back.

## 8.2 Expiry Classification

**Where:** `StockBatch.expiry_status` (per batch) and `Product.available_quantity`
(per product).

| Status | Rule |
|--------|------|
| `expired` | `expiry_date < today` |
| `ageing` | `today ≤ expiry_date ≤ today + AGEING_THRESHOLD_DAYS` (3 days) |
| `fresh` | `expiry_date > today + 3 days` |

The status is **computed on every read, never stored** — a stored value would be wrong the
moment the clock passes midnight. `available_quantity` sums only non-expired batches, so
expired stock is invisible to selling but visible to the dashboard and to the shelf.

A product's shelf colour is the **worst** status among its non-empty batches
(`expired > ageing > fresh`).

## 8.3 Automatic Reordering

**Where:** `services.raise_auto_reorders`, `services.open_purchase_order`,
`services.fulfil_purchase_orders`.

A purchase order is raised for a product when **all** of the following hold:

1. `auto_reorder` is on;
2. the product has a supplier;
3. `reorder_quantity > 0`;
4. `available_quantity ≤ reorder_threshold`;
5. **no purchase order for that product is already `placed`.**

Condition 5 is what stops a run of sales below the threshold from stacking duplicate orders
for stock that is already on its way.

**Trigger points**

| Event | Behaviour |
|-------|-----------|
| An order is created | Reorders are evaluated for the products just sold, inside the order's transaction — so a rolled-back order cannot leave a purchase order behind |
| A product is created | Evaluated immediately, so a product created already below its threshold orders at once |
| A product is updated | Evaluated immediately, so turning the toggle on (or lowering the threshold onto current stock) orders now rather than at the next sale |
| A stock batch is received | Any `placed` order for that product is closed as `received`, re-opening the next reorder cycle |

Receiving stock is the only signal the application has that a supplier delivered; without
closing the order, condition 5 would block every future reorder for that product.

## 8.4 Order Lifecycle

```
        POST /api/orders/            PATCH {status}         PATCH {status}
  (stock deducted FIFO here)              │                       │
             │                            ▼                       ▼
             ▼
        ┌─────────┐               ┌───────────┐            ┌───────────┐
        │ pending │ ────────────► │ processed │ ─────────► │ delivered │
        └─────────┘               └───────────┘            └───────────┘
                                                                 │
                                                                 ▼
                                                      ensure_invoice(order)
                                                      → INV-<year>-<seq>
```

- Transitions are **forward-only**; any other move returns `400` naming the allowed flow.
- Re-sending the current status is accepted and does nothing.
- Orders cannot be edited or deleted after creation.
- Stock is deducted once, at creation — cancelling is therefore not supported in this build
  (there is no path that returns units to their batches).

## 8.5 Invoice Generation and Numbering

**Where:** `services.ensure_invoice`, `services.next_invoice_number`.

**Total:** `Σ (quantity × unit_price)` over the order's items, using the price snapshot taken
at order time — so a later price change never rewrites a historical bill.

**Numbering:** `INV-<year>-<4-digit sequence>`, e.g. `INV-2026-0001`. The sequence restarts
each calendar year, the way a shop's bill book does.

The next number is derived from the **newest invoice of that year, ordered by `id`** — not by
counting rows and not by sorting the number string:

- Counting rows would hand out a number twice after a bill was deleted.
- Sorting lexically would place `INV-2026-10000` before `INV-2026-9999` once a year exceeded
  the padding width.

**Concurrency.** Uniqueness is the database column's job, not the generator's. `ensure_invoice`
attempts creation inside its own savepoint and retries up to five times on `IntegrityError`:

- If another delivery took the number, the next attempt picks the following one.
- If the collision was *this same order* being invoiced concurrently, the racing invoice is
  returned instead.

**Idempotence.** `ensure_invoice` returns the existing invoice if one exists, so re-confirming
a delivery can never raise a second bill for the same order.

## 8.6 Role-Based Access Control

Three layers, each of which holds on its own:

| Layer | Mechanism | Example |
|-------|-----------|---------|
| **Route** | `RequireOwner` in `App.jsx` | `/invoices`, `/reports`, `/staff*` redirect a staff user to `/` |
| **Endpoint** | `IsOwner` / `CanManageStaff` permission classes | `/api/invoices/`, `/api/staff/` return `403` |
| **Field** | Serialiser and view logic | `purchase_price` stripped from batch responses; monetary keys omitted from the dashboard |

The frontend gates are convenience only — the API refuses a staff token regardless of which
URL the browser is pointed at.

**Owner-only surfaces:** invoices; staff management; the Reports page; deleting a product,
supplier or customer; batch purchase prices; and the three monetary dashboard KPIs.

**Staff can:** sign in, see the dashboard (non-financial KPIs), maintain products and
suppliers, receive stock, add customers, take orders and advance order status.

## 8.7 Referential Integrity as User-Facing Rules

Django's `PROTECT` and `CASCADE` behaviours are translated into readable `400` responses
rather than being allowed to surface as `500`s:

| Attempted deletion | Response |
|--------------------|----------|
| Product that appears on order lines | *"'X' appears on N order line(s) and cannot be deleted. Its sales history depends on it."* |
| Product that still holds stock | *"'X' still has N unit(s) across M stock batch(es). Clear the stock before deleting the product."* |
| Supplier that supplies products | *"'X' supplies N product(s) (…) and cannot be deleted. Reassign them to another supplier first."* |
| Customer named on orders | *"'X' is named on N order(s) and cannot be deleted. Their trading history depends on it."* |
| Any staff member | `405` — deactivate instead |

Deleting a product also removes its uploaded photograph from `MEDIA_ROOT`, so the media
directory does not accumulate orphans; the same happens when a photo is replaced or cleared.

## 8.8 Client-Side Session Handling

`frontend/src/api/client.js` implements the token lifecycle:

1. The token pair and role are held in memory and mirrored to `localStorage`, so a page
   reload does not force a re-login.
2. A request interceptor attaches `Authorization: Bearer <access>`.
3. A response interceptor catches `401`, calls `/api/auth/refresh/` **once** (a single-flight
   promise, so ten parallel 401s trigger one refresh, not ten), and retries the original
   request exactly once.
4. If the refresh itself fails, the stored auth is cleared and the browser is sent to
   `/login`.

---

# Chapter 9: Deployment and Configuration

## 9.1 Prerequisites

| Tool | Version | Source |
|------|---------|--------|
| Git | any recent | <https://git-scm.com/downloads> |
| Docker Desktop (or Docker Engine + Compose v2) | latest | <https://www.docker.com/products/docker-desktop/> |

Nothing else is required — Python, Node and PostgreSQL are supplied by the images.

**Windows:** Docker Desktop requires hardware virtualisation. Both the *Virtual Machine
Platform* Windows feature and virtualisation in the BIOS/UEFI must be enabled, or the engine
silently never starts. Verify with `wsl --status` (see §12.1).

## 9.2 Standard Deployment (Docker Compose)

```bash
git clone https://github.com/TanmayKamble004/DairyDesk.git
cd DairyDesk
docker compose up --build
```

There is nothing else to configure: `docker-compose.yml` supplies a working default for
every variable, so a bare clone runs without a `.env` file.

On startup the backend container:

1. waits for PostgreSQL to accept connections;
2. applies all migrations (`manage.py migrate --noinput`);
3. seeds demo data **only if the database has no users** — a restart never destroys work
   someone has entered.

The stack is ready when the logs show:

```
dairydesk_backend  | Demo data seeded.
dairydesk_backend  |   Products:     7
dairydesk_backend  |   StockBatches: 15
dairydesk_backend  | Starting development server at http://0.0.0.0:8000/
dairydesk_frontend |   VITE v8.1.3  ready in 585 ms
```

| Service | URL |
|---------|-----|
| Frontend | <http://localhost:5173> |
| API | <http://localhost:8000> |
| Django admin | <http://localhost:8000/admin> |
| Health check | <http://localhost:8000/api/health/> |
| Browsable API login | <http://localhost:8000/api-auth/login/> |

Verify with `curl http://localhost:8000/api/health/` → `{"status":"ok"}`.

**Subsequent runs:** `docker compose up` (add `-d` to detach; `--build` only after a
dependency change). Stop with `Ctrl+C`, or `docker compose down` if detached.

## 9.3 Container Topology

| Service | Image | Published port | Notes |
|---------|-------|----------------|-------|
| `db` | `postgres:16` | `${POSTGRES_PORT:-5432}` → 5432 | Named volume `dairydesk_pgdata`; `pg_isready` health check every 5 s |
| `backend` | built from `./backend` (`python:3.13-slim`) | `${BACKEND_PORT:-8000}` → 8000 | Waits on `db: service_healthy`; source bind-mounted for autoreload; `stdin_open`/`tty` so `breakpoint()` works via `docker attach` |
| `frontend` | built from `./frontend` (`node:22-alpine`) | `${FRONTEND_PORT:-5173}` → 5173 | Source bind-mounted; anonymous volume masks the host's `node_modules` |

Inside the compose network the backend always reaches PostgreSQL as `db:5432`; `DB_HOST` and
`DB_PORT` from `.env` describe how the **host** reaches it, which is why one `.env` serves
both ways of running.

## 9.4 Running Without Docker

Requires Python 3.12+ and Node 20+ on the host.

```bash
cp .env.example .env                      # PowerShell: Copy-Item .env.example .env
cp frontend/.env.example frontend/.env    # PowerShell: Copy-Item frontend\.env.example frontend\.env

docker compose up -d db                   # database only
```

```bash
cd backend
python -m venv .venv
source .venv/bin/activate                 # PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Ensure `DB_PORT` in `.env` matches `POSTGRES_PORT` — on this path Django connects through the
published host port rather than the compose network.

## 9.5 Configuration

All configuration is read from environment variables; nothing is hardcoded [13]. `.env` is
**optional** — create one only to override a default. See Appendix A for the full reference.

## 9.6 Production Readiness

The current configuration targets a local demo. Before any deployment beyond a trusted LAN,
the following must change:

| Item | Current | Required |
|------|---------|----------|
| `DEBUG` | `True` | `False` |
| `SECRET_KEY` | `dev-insecure-change-me` (**22 bytes — below the 32-byte HMAC-SHA256 minimum of RFC 7518 §3.2** [46]; the test run warns about this) | A generated secret of at least 32 bytes, from a secret store, never committed. `get_random_secret_key()` produces 50 characters |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,backend` | The real hostname(s) |
| Web server | Django's `runserver` | A WSGI server (gunicorn/uWSGI) behind nginx |
| Static and media files | Served by Django when `DEBUG` is on | A real file server or object store in front of `MEDIA_ROOT` |
| Transport | HTTP | TLS, with `SECURE_SSL_REDIRECT`, HSTS and secure cookie flags |
| Token storage | `localStorage` | Consider `httpOnly` cookies to reduce XSS exposure |
| Token lifetimes | 8 h access / 7 d refresh | Shorten; enable refresh-token rotation and blacklisting [5] |
| Database credentials | `dairydesk`/`dairydesk` | Strong, environment-supplied credentials |
| Backups | Manual `pg_dump` | Scheduled, tested restores |
| CORS | `http://localhost:5173` | The real frontend origin only |

## 9.7 Backup and Restore

```bash
# Backup
docker compose exec db pg_dump -U dairydesk dairydesk > backup-$(date +%F).sql

# Restore into an empty database
docker compose exec -T db psql -U dairydesk dairydesk < backup-2026-09-01.sql
```

A sample dump, `backup-2026-09-01.sql`, is committed at the repository root.

## 9.8 Reseeding

```bash
docker compose exec backend python manage.py seed_demo   # clears and reseeds
docker compose down -v && docker compose up              # wipe the volume entirely
```

`seed_demo` **clears the tables it seeds**, so it is destructive by design; the startup
script therefore runs it only against a database with no users.

---

# Chapter 10: User Guide

*Intended reader: the shop owner and counter staff. No technical knowledge assumed.*

## 10.1 Signing In

Open <http://localhost:5173> and enter the username and password issued by the owner. The
system knows whether you are an **owner** or a **staff** member and shows only the pages
your role is allowed to use.

Demo accounts (see Appendix B):

| Role | Username | Password |
|------|----------|----------|
| Owner | `owner` | `owner123` |
| Staff | `staff` | `staff123` |

If sign-in fails, either the password is wrong or the account has been switched off; ask the
owner.

## 10.2 The Dashboard

The dashboard is the home screen.

**KPI tiles.** Owners see six figures: total available stock value, products ageing,
products expired, today's orders, today's sales and unpaid invoices. Staff see the three
non-financial figures. This is intentional, not a fault.

**The 3D inventory shelf.** Each product is a stack of crates. The stack's **height** is how
much you have; its **colour** is the health of its worst batch:

| Colour | Meaning | What to do |
|--------|---------|------------|
| 🟩 Green | Fresh — more than 3 days to expiry | Nothing |
| 🟨 Amber | Ageing — 3 days or fewer | Sell or discount it first |
| 🟥 Red | Expired — past its date | Remove it from the shelf |

Drag to rotate, scroll to zoom, and click a stack to open a panel showing the product's
available quantity, its batch breakdown and its nearest expiry date.

**Panels.** Below the shelf: stock by category, a seven-day order trend, an expiring-soon
list and the most recent orders. Owners see rupee values where staff see counts.

## 10.3 Products

**Products** lists everything you sell, with its available quantity and a stock badge — *In
stock*, *Low stock* or *Out of stock*, judged against the product's reorder threshold.

**Adding a product.** Click **New product** and fill in: name, SKU (a unique code, e.g.
`MLK-1001`), category, supplier, unit (litre / kg / piece) and selling price. Optionally add
a description and a photograph.

**Reorder settings.**

- **Reorder threshold** — the level at which the product counts as low.
- **Reorder quantity** — how many units to order when it gets there. This must be at least
  the threshold, otherwise restocking would leave the product still low.
- **Auto-reorder** — when on, the system raises a purchase order to that product's supplier
  automatically, without anyone asking. It will not raise a second one while the first is
  still outstanding.

**Deleting a product.** Owner only, and refused if the product has ever been sold or still
holds stock. Both are protections, not faults: deleting would destroy sales history or lose
stock silently.

## 10.4 Receiving Stock

Go to **Inventory** → **Receive stock** and enter the product, quantity, purchase price,
expiry date and received date. Each entry creates one **batch**, which is why two deliveries
of milk with different expiry dates stay separate and are sold in the right order.

Two things happen automatically: the new batch joins the product's available quantity, and
any outstanding purchase order for that product is closed as *received*.

Staff enter the purchase price but cannot see it afterwards. Only the owner can read cost
prices.

## 10.5 Taking an Order

Go to **Orders** → **New order**.

1. Choose the customer, or add a new one on the spot (name and phone are required).
2. Add products and quantities.
3. Save.

Stock is deducted **as soon as the order is saved**, from the oldest batches first, so the
oldest milk always leaves first. If there is not enough stock, the order is refused and the
message names exactly which products are short and by how much — nothing is deducted.

**Advancing an order.** *Pending* → *Processed* (packed) → *Delivered*. The flow only moves
forward; there is no way back. Marking an order **delivered** automatically raises its
invoice.

## 10.6 Invoices — *Owner only*

**Invoices** lists every bill, newest first, with its bill number (e.g. `INV-2026-0004`),
issue date, order, customer, total, amount paid and status.

The bill number is what a customer quotes back on the phone. Numbers are never reused, and
the sequence restarts each January.

> **Current limitation.** Recording a payment is not yet available on this page. Until it is,
> payments must be entered by the owner through the Django admin at
> `http://localhost:8000/admin` → *Invoices*.

## 10.7 Suppliers

**Suppliers** lists the wholesalers you buy from, with contact person, phone, email, the
number of products supplied, the last order date and a 0–5 rating. Add or edit from this
page. A supplier that supplies any product cannot be deleted until those products are moved
to another supplier.

## 10.8 Alerts

Reached from the dashboard's attention count. It gathers everything needing action:

| Alert | Meaning |
|-------|---------|
| Out of stock | No sellable units left |
| Low stock | At or below the reorder threshold |
| Overstock | More than three restock cycles above the reorder point — cash tied up |
| Ageing | Batches within three days of expiry |
| Expired | Batches past their date |

Each row carries a recommended action, and takes account of any purchase order already
outstanding, so you are never told to order something that is already on its way.

## 10.9 Stock Levels and Reports

**Stock Levels** shows stock movement over the last 7 / 30 days and a category rollup.

**Reports** (owner only) lets you choose a date range and a report type, preview the rows and
export them to CSV, which opens directly in Excel.

> **Current limitation.** Both pages currently render from a built-in demonstration dataset
> rather than from your live data. Treat them as a preview of the reporting feature. The
> live figures are on the Dashboard and Inventory pages.

## 10.10 Staff — *Owner only*

**Staff** lists everyone who can sign in, owners first.

- **Add** a person with their name, email, role and a starting password.
- **Edit** their details, or switch them **off** when they leave. Switching someone off ends
  their session immediately and blocks future sign-ins, while keeping their name on past
  orders — which is why nobody is ever deleted.
- **Reset password** sets a new one. Passwords are stored scrambled and cannot be read back,
  so replacing is the only option.

Two rules the system will not let you break: you cannot switch off or demote your own
account, and the last remaining owner cannot be switched off or demoted. Either would lock
the shop out of its own administration.

## 10.11 Everyday Tasks — Quick Reference

| I want to… | Go to |
|------------|-------|
| See how the shop is doing today | Dashboard |
| Find out what is about to expire | Dashboard shelf (amber/red) or Alerts |
| Record a delivery from a supplier | Inventory → Receive stock |
| Sell to a customer | Orders → New order |
| Mark an order as delivered / raise its bill | Orders → status buttons |
| Check who owes money | Invoices *(owner)* |
| Add a new product | Products → New product |
| Turn on automatic reordering | Products → edit → Auto-reorder |
| Give someone a login | Staff → New *(owner)* |

---

# Chapter 11: Developer Guide

## 11.1 Repository Layout

```
DairyDesk/
├── backend/                     Django project
│   ├── config/                  settings, root urls, wsgi/asgi
│   ├── core/                    the application
│   │   ├── models.py            entities + derived properties
│   │   ├── services.py          business rules (FIFO, reorder, invoicing)
│   │   ├── serializers.py       validation + write orchestration
│   │   ├── permissions.py       is_owner, IsOwner, CanManageStaff
│   │   ├── views.py             viewsets + aggregation endpoints
│   │   ├── urls.py              route table
│   │   ├── admin.py             back-office over every model
│   │   ├── tests.py             96 API/behaviour tests
│   │   ├── migrations/          0001 … 0006
│   │   └── management/commands/seed_demo.py
│   ├── health/                  /api/health/ liveness probe
│   ├── Dockerfile               python:3.13-slim
│   ├── docker-entrypoint.sh     wait-for-db → migrate → conditional seed
│   └── requirements.txt         pinned dependencies
├── frontend/                    React SPA
│   └── src/
│       ├── api/client.js        axios instance, token store, refresh interceptor
│       ├── auth/AuthContext.jsx session context
│       ├── components/          Layout, InventoryShelf, GlassModal, Toast, charts, ui
│       ├── data/                alerts.js (live), storeMock.js (demo data)
│       ├── pages/               14 route components
│       └── App.jsx              routes + RequireAuth / RequireOwner guards
├── dairydesk-inventory/         standalone HTML/CSS/JS inventory prototype
├── diagrams/                    DairyDesk_Diagrams.drawio + PNG exports
├── docs/                        this document, developer-guide.html
├── docker-compose.yml           db + backend + frontend
├── .env.example                 configuration reference
├── PROJECT_SPEC.md              the original build spec (MVP cut)
└── README.md                    setup and day-to-day commands
```

## 11.2 Day-to-Day Development

Source is bind-mounted into both containers, so **editing `.py`, `.jsx` or `.css` needs no
command** — Django's autoreloader and Vite's HMR pick changes up immediately. Only these
situations need an action:

| Situation | Command |
|-----------|---------|
| Added a package to `backend/requirements.txt` | `docker compose up -d --build backend` |
| Added an npm package | `docker compose up -d --build --renew-anon-volumes frontend` |
| Changed a model | `docker compose exec backend python manage.py makemigrations` |
| Pulled a branch with new migrations | `docker compose restart backend` |
| Any other `manage.py` command | `docker compose exec backend python manage.py <cmd>` |
| Watching logs | `docker compose logs -f backend` |
| A shell in a container | `docker compose exec backend bash` (frontend is Alpine — use `sh`) |
| Wipe the database and start fresh | `docker compose down -v && docker compose up` |

`--renew-anon-volumes` is required for npm changes because `node_modules` lives in an
anonymous volume that would otherwise keep the old packages.

**Debugging.** The backend container has a TTY attached, so `breakpoint()` works: drop it in,
then `docker attach dairydesk_backend`. Detach with `Ctrl+P Ctrl+Q` (`Ctrl+C` would stop the
container).

## 11.3 Testing

```bash
docker compose exec backend python manage.py test              # whole suite
docker compose exec backend python manage.py test core         # the core app
docker compose exec backend python manage.py test core.ProductDeletionTests -v 2
```

The suite (`backend/core/tests.py`, ~1,270 lines, 97 tests across 11 test classes) covers the
areas below. **Last verified run: 97 passed, 0 failed, in 18.9 s**, with `manage.py check`
reporting no issues — see §13.1.1 for the transcript.

| Area | Examples |
|------|----------|
| Cost confidentiality | Owner sees `purchase_price`; staff does not, on both read and create |
| Dashboard gating | Owner gets financial KPIs; staff does not |
| Product CRUD | Required fields, duplicate SKU, image upload and clearing, reorder validation |
| Product deletion guards | Refused when stocked or ordered; photo removed from disk |
| Suppliers | Validation, rating bounds, future date rejection, deletion guard |
| Auto-reorder | Raises on threshold, does not stack, resumes after delivery, closes on receipt |
| Invoice numbering | Sequence, yearly restart, deleted bills do not free numbers, uniqueness, idempotence |
| Customers | Creation mid-order, deletion guard |
| Staff management | Password strength, duplicate email, self-demotion, last-owner protection, token revocation |
| Categories | Distinct, sorted, appear when a product is saved |
| Seeding | Re-seeding over existing data succeeds |

The run emits one warning, `InsecureKeyLengthWarning`, from the default `SECRET_KEY`. It is a
genuine finding, not test noise — see §13.2, D10. Setting a proper key clears it.

Frontend linting: `docker compose exec frontend npm run lint` (oxlint).

**There is currently no frontend test suite** — see §13.5.

## 11.4 Adding a Feature — Worked Pattern

To add an endpoint, follow the layering already in place:

1. **Model** (`models.py`) — add fields and any *derived* property. Never store something
   that can be computed from the clock.
2. **Migration** — `makemigrations`, review the generated file, commit it.
3. **Business rule** (`services.py`) — if the rule spans models or must be callable outside a
   request, put it here as a plain function.
4. **Serialiser** (`serializers.py`) — field validation, `validate()` for cross-field rules,
   and `create`/`update` to orchestrate service calls inside `transaction.atomic()`.
5. **Permission** (`permissions.py`) — reuse `IsOwner`, or subclass it for a differently
   worded message.
6. **View** (`views.py`) — pick the narrowest set of mixins that does the job; override
   `get_permissions` for per-action gating and `perform_destroy` for deletion guards.
7. **Route** (`urls.py`) — register on the router.
8. **Test** (`tests.py`) — one test per rule, including the refusal path.
9. **Client** (`frontend/src/`) — page under `pages/`, route in `App.jsx`, nav entry in
   `components/Layout.jsx`, calls via `api` from `api/client.js`.

**House conventions observed throughout the codebase:**

- Business rules are enforced **server-side**; the client never computes an authoritative
  figure.
- Referential-integrity failures are converted to `400`s with a sentence explaining *why*,
  never allowed to surface as `500`s.
- Comments explain *why*, not *what* — see `services.next_invoice_number` for the house style.
- Every destructive or financial surface is owner-gated at both the route and the endpoint.

## 11.5 The 3D Inventory Shelf

`frontend/src/components/InventoryShelf.jsx` renders `GET /api/inventory/` as a
react-three-fiber scene [33]:

- A `<Canvas>` with drei's `OrbitControls` for rotate and zoom [34].
- One stack of `<boxGeometry>` crates per product; crate count is proportional to
  `available_quantity`, capped so a large stock does not leave the frame, with a minimum of
  one.
- Crate colour from `worst_status`: green / amber / red.
- Labels via drei's text helpers; hover highlights; clicking a stack raises a detail panel
  with quantity, batch breakdown and nearest expiry.

Geometry is parametric — there are no imported 3D models — and the scene is entirely
data-driven, which is the point: it reflects the real API response, never hardcoded values.

## 11.6 Frontend Data Sources

| Page | Source |
|------|--------|
| Dashboard | `/api/dashboard/`, `/api/inventory/`, `/api/orders/` |
| Products, Product form | `/api/products/`, `/api/products/categories/`, `/api/suppliers/` |
| Inventory | `/api/inventory/`, `/api/products/`, `POST /api/stock-batches/` |
| Orders | `/api/orders/`, `/api/customers/`, `/api/products/` |
| Suppliers, Supplier form | `/api/suppliers/` |
| Invoices | `/api/invoices/` |
| Staff, Staff form | `/api/staff/` |
| Alerts | `/api/products/`, `/api/orders/` |
| **Stock Levels** | **`data/storeMock.js` (demo data)** |
| **Reports** | **`data/storeMock.js` (demo data)** |

`storeMock.js` also exports the shared formatting helpers (`num`, `inr`, `fmtDate`,
`fmtDateTime`) used across live pages; only the `PRODUCTS` and `MOVEMENT` arrays are demo
data. As endpoints arrive for those two pages, the file shrinks to the helpers.

## 11.7 Django Admin

`http://localhost:8000/admin` (the `owner` demo account is a superuser). Every model is
registered with useful list displays, filters and search fields, including a custom
**expiry-status filter** on stock batches that re-derives the fresh / ageing / expired date
ranges in SQL, and inline order items on the order page.

The admin is currently the **only** way to record an invoice payment.

## 11.8 Git Workflow

Feature branches merged into `main` through pull requests, as the history shows
(`feat: staff management, alerts, and invoice numbering`,
`fix: restrict stock batch purchase price to owner role`). Commit subjects follow a
`type: summary` convention (`feat:`, `fix:`, `docs:`).

`.gitattributes` forces LF endings on `docker-entrypoint.sh`; a CRLF checkout breaks
container startup (§12.3).

---

# Chapter 12: Troubleshooting

## 12.1 Startup and Docker

| Symptom | Cause | Fix |
|---------|-------|-----|
| *"Docker daemon not running"* | Docker Desktop not started | Open Docker Desktop and wait for the whale icon to stop animating |
| Docker Desktop never finishes starting (Windows) | Virtualisation disabled | Run `wsl --status`. If it reports virtualisation is not enabled, run from an **elevated** prompt and **reboot**: `dism /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart`. If it still fails, enable VT-x / AMD-V / SVM in the BIOS/UEFI. `wsl --status` keeps reporting the error until you reboot, even once the feature is on |
| `Port already in use` | 8000, 5173 or 5432 is taken | Set `BACKEND_PORT`, `FRONTEND_PORT` or `POSTGRES_PORT` in `.env`. If you change `FRONTEND_PORT`, also set `VITE_HMR_CLIENT_PORT` to the same value so hot reload reconnects |
| `exec /app/docker-entrypoint.sh: no such file or directory` | The shell script has CRLF line endings | `.gitattributes` prevents this; a clone made before it was added needs `git rm --cached -r . && git reset --hard` (commit your work first) |
| Backend restarts in a loop | PostgreSQL not reachable | `docker compose logs db`; confirm the `db` service is healthy (`docker compose ps`) |

## 12.2 Application Behaviour

| Symptom | Cause | Fix |
|---------|-------|-----|
| Login fails with correct credentials | The account is switched off (`is_active=False`) | An owner re-enables it on the Staff page. The seeded `amit` account is disabled deliberately |
| Every request returns `401` after a while | Refresh token expired (7 days) | Sign in again |
| A page redirects to the dashboard immediately | Owner-only route accessed by staff | Expected; sign in as an owner |
| `403 "Only the owner can access financial data."` | Staff token on an owner endpoint | Expected |
| `purchase_price` missing from a batch response | Caller is not an owner | Expected — cost data is owner-only |
| Dashboard is missing three KPIs | Caller is not an owner | Expected |
| *"Insufficient stock for 'X' (requested N, available M)"* | Not enough non-expired stock | Receive a batch first. Expired batches are never counted |
| *"Cannot transition from 'pending' to 'delivered'"* | Status skips a step | Move to `processed` first |
| Cannot delete a product / supplier / customer | Referenced by trading history or stock | Read the message: clear stock, or reassign products, or accept that history-bearing rows are permanent |
| `DELETE /api/staff/{id}/` returns `405` | By design | Switch the person off instead |
| A product stays low and never reorders | One of the five conditions is unmet | Check: auto-reorder on, supplier set, `reorder_quantity > 0`, stock at/below threshold, and no purchase order already outstanding |
| Two purchase orders never appear for one product | By design | Only one may be `placed` at a time; receiving stock closes it |
| Reports and Stock Levels show unfamiliar products | Those pages render demo data | Known limitation — see §13.2 |
| No way to record a payment | No API in this build | Use the Django admin → Invoices |

## 12.3 Development

| Symptom | Cause | Fix |
|---------|-------|-----|
| Frontend changes don't hot reload | Editing outside `frontend/src/`, or the container is stopped | `docker compose ps`; on Windows/WSL2 polling is required and is enabled by `VITE_USE_POLLING=1` in compose |
| `Cannot find module` after pulling | Someone added a dependency | `docker compose up -d --build --renew-anon-volumes frontend` |
| Backend not picking up a new package | Image not rebuilt | `docker compose up -d --build backend` |
| `no such table` / `relation does not exist` | Migrations not applied | `docker compose restart backend`, or `docker compose exec backend python manage.py migrate` |
| Database looks empty or stale | Volume carries old data | `docker compose down -v && docker compose up` (destroys data) |
| Seed data didn't appear | The database already had users | Seeding only runs on an empty database. Force it: `docker compose exec backend python manage.py seed_demo` |
| CORS error in the browser console | Origin not allow-listed | Add it to `CORS_ALLOWED_ORIGINS` in `.env` |
| 3D shelf is blank or the page is slow | WebGL unavailable or disabled | Check `chrome://gpu`; enable hardware acceleration |
| Uploaded product photos 404 | `DEBUG=False` with no file server | Django serves `MEDIA_ROOT` only while `DEBUG` is on — see §9.6 |

## 12.4 Diagnostic Commands

```bash
docker compose ps                                   # service health
docker compose logs -f backend                      # follow backend logs
curl http://localhost:8000/api/health/              # API liveness
docker compose exec backend python manage.py check  # Django system checks
docker compose exec backend python manage.py showmigrations
docker compose exec db psql -U dairydesk -d dairydesk -c '\dt'
docker compose exec backend python manage.py shell  # ORM console
```

---

# Chapter 13: Validation Report

The documentation above was cross-checked against the source tree on **7 September 2026**
(branch `main`, commit `0655921`). Files inspected: `backend/core/{models,views,serializers,
services,permissions,urls,admin,tests}.py`, `backend/config/{settings,urls}.py`,
`backend/health/`, all six migrations, `seed_demo.py`, `docker-compose.yml`, both
`Dockerfile`s, `docker-entrypoint.sh`, `.env.example`, `requirements.txt`,
`frontend/package.json`, `vite.config.js`, and all 14 pages plus 7 components under
`frontend/src/`.

> **Method.** Validation was performed in two passes: **static inspection of the source**,
> followed by **execution against the running stack**. The full test suite was run, and every
> endpoint contract, role gate and error message documented in Chapter 7 was exercised
> against the live API. Results are recorded in §13.1.1 and §13.1.2.

### 13.1.1 Test Suite Execution

```
$ docker compose exec backend python manage.py test
Found 97 test(s).
Creating test database for alias 'default'...
System check identified no issues (0 silenced).
.................................................................................................
----------------------------------------------------------------------
Ran 97 tests in 18.898s

OK
```

**All 97 tests pass.** `manage.py check` reports no issues. The run emitted one warning,
which is a genuine finding — see §13.2, D10.

### 13.1.2 Live API Verification

Every row below was executed against the running stack and the response compared with this
document. Environment: `dairydesk_backend`, `dairydesk_db` (healthy) and `dairydesk_frontend`
all up; database in its working state (8 products, 1 supplier, 5 customers, 7 orders,
3 invoices, 16 batches, 2 users) rather than freshly seeded.

| Check | Expected (as documented) | Observed | ✔ |
|-------|--------------------------|----------|---|
| `GET /api/health/` (no token) | `{"status":"ok"}` | `200 {'status': 'ok'}` | ✔ |
| `POST /api/auth/login/` (owner) | `access`, `refresh`, `username`, `role` | exactly those four keys; `role='owner'` | ✔ |
| `POST /api/auth/login/` (staff) | `role='staff'` | `role='staff'` | ✔ |
| Login as a **disabled** account | rejected | `401` | ✔ |
| `GET /api/dashboard/` (owner) | 6 keys incl. 3 monetary | `total_available_stock_value`, `products_ageing_count`, `products_expired_count`, `todays_order_count`, `todays_sales_total`, `unpaid_invoice_count` | ✔ |
| `GET /api/dashboard/` (staff) | monetary keys **absent**, not null | exactly 3 non-financial keys | ✔ |
| `GET /api/inventory/` | `id, name, category, unit, available_quantity, batch_counts{fresh,ageing,expired}, worst_status, nearest_expiry` | exact match | ✔ |
| Expired-only product | excluded from `available_quantity`; `nearest_expiry` null | `available_quantity: 0`, `nearest_expiry: null`, `worst_status: 'expired'` | ✔ |
| `GET /api/stock-batches/` (owner) | includes `purchase_price` | present | ✔ |
| `GET /api/stock-batches/` (staff) | `purchase_price` **stripped** | absent; all 7 other fields present | ✔ |
| `GET /api/invoices/` (owner) | `number` as `INV-<year>-<seq>` | `INV-2026-0003` | ✔ |
| `GET /api/invoices/` (staff) | `403` | `403 "Only the owner can access financial data."` | ✔ |
| `GET /api/staff/` (staff) | `403` | `403` | ✔ |
| `DELETE /api/staff/{id}/` (owner) | `405` by design | `405` | ✔ |
| `PUT /api/orders/{id}/` | `405` (PATCH only) | `405` | ✔ |
| `GET /api/products/` | 16 fields incl. derived | exact match | ✔ |
| `GET /api/products/categories/` | distinct, sorted | `['Fats','Fermented','Fresh Cheese','Milk']` | ✔ |
| `GET /api/purchase-orders/?status=placed` | filter accepted | `200` | ✔ |
| Order with insufficient stock | `400`, names product, requested and available; nothing deducted | `{'items': ["Insufficient stock for 'Amul diamond' (requested 99999, available 0)."]}` | ✔ |
| Order with empty basket | `400` | `{'items': ['An order needs at least one item.']}` | ✔ |
| Illegal status transition | `400` naming the allowed flow | `"Cannot transition from 'pending' to 'delivered'. Allowed flow: pending -> processed -> delivered."` | ✔ |
| Invoice ordering | newest bill first | `INV-2026-0003, 0002, 0001` | ✔ |

**No documented contract failed.** Chapter 7 is accurate as written.

### 13.1.3 Confirmed Runtime Versions

Read from the running containers, superseding the declared ranges in Chapter 5.

| Component | Declared | **Resolved at runtime** |
|-----------|----------|-------------------------|
| Python | `python:3.13-slim` | **3.13.15** |
| Django | `==5.1.4` | **5.1.4** |
| Django REST Framework | `==3.15.2` | **3.15.2** |
| djangorestframework-simplejwt | `==5.4.0` | **5.4.0** |
| psycopg | `==3.2.3` | **3.2.3** |
| Pillow | `==11.0.0` | **11.0.0** |
| PostgreSQL | `postgres:16` | **16.15** (Debian build) |
| Node.js | `node:22-alpine` | **22.23.2** |
| React / React DOM | `^19.2.7` | **19.2.7** |
| Vite | `^8.1.1` | **8.1.3** |
| Tailwind CSS | `^4.3.2` | **4.3.2** |
| three | `^0.185.1` | **0.185.1** |
| @react-three/fiber | `^9.6.1` | **9.6.1** |
| @react-three/drei | `^10.7.7` | **10.7.7** |
| axios | `^1.18.1` | **1.18.1** |
| react-router-dom | `^7.18.1` | **7.18.1** |
| oxlint | `^1.71.0` | **1.72.0** |

The backend dependencies are exact-pinned and resolve exactly as declared. The frontend uses
caret ranges; only `vite` and `oxlint` have drifted above their declared floor, both within
the permitted range.

## 13.1 Verification Summary

| Checked | Result |
|---------|--------|
| API paths, methods and auth requirements | **Accurate as documented in Chapter 7** — verified against `core/urls.py` and every viewset's mixin set |
| Request/response shapes | **Accurate** — verified against each serialiser's `fields` list |
| Data models, field types, relationships | **Accurate as documented in Chapter 6**; the report's §3.4.2 dictionary is *incomplete* relative to the code (see §13.2) |
| FIFO deduction | **Correct**, with one timing discrepancy against the report (§13.2, D1) |
| Order lifecycle | **Correct as documented** |
| Invoice generation and numbering | **Correct as documented** |
| Auto-reorder rule | **Correct as documented** |
| Role-based access control | **Correct as documented**, enforced at route, endpoint and field level |
| Deployment instructions and env vars | **Accurate and complete** — every variable in `.env.example` is consumed; every compose default matches |
| Docker configuration | **Accurate** |

## 13.2 Discrepancies Between the Report and the Implementation

| # | Report says | Implementation does | Severity |
|---|-------------|---------------------|----------|
| **D1** | §3.1.2 Step 3 and the Activity Diagram: stock is deducted "as orders are fulfilled" / on the transition to *processed*. | Deduction happens at **order creation** (`OrderSerializer.create`), while the order is still *pending*. | **Medium** — the rule is sound and arguably better (it reserves stock immediately), but the documented trigger is wrong. Fixed in this document (§8.1); Figure 3.7 still shows the old flow. |
| **D2** | §3.1.5 Steps 3–4 and Level 2 DFD process 4.2: "when a customer makes a payment, the amount paid is recorded directly against the relevant invoice" and status updates automatically. | `InvoiceViewSet` is `ReadOnlyModelViewSet`. **No endpoint records a payment**, and no code derives `status` from `paid_amount`. The fields are only ever set by `seed_demo` or the Django admin. | **High** — a documented core feature has no API. |
| **D3** | §3.1.6: reports for a chosen date range and category. | The **Reports page renders from `storeMock.js`**, not from the API. There is no reporting endpoint. Its CSV export is real; its data is not. | **High** |
| **D4** | §3.4.2 data dictionary and Figure 3.2. | Missing `Supplier` and `PurchaseOrder` entirely; missing `Product.{sku, supplier, description, image, reorder_quantity, reorder_threshold, auto_reorder}`, `User.{is_active, first_name, last_name, email}`, and `Invoice.{number, created_at}`. | **High** (for the report; Chapter 6 supersedes it) |
| **D5** | §1.5.1: "Customer registration **and subscription management**". | No `Subscription` model, endpoint or UI. Correctly noted as deferred in §3.1.3, but the feature list still reads as delivered. | Low |
| **D6** | §1.5.1: "Order placement **and delivery scheduling**". | No scheduling: delivery is a status value on `Order`, with no date, route, or assignee. | Low |
| **D7** | §3.2 Hardware: "Internet connection" listed as a hardware requirement. | Required only to build the images. The running application needs no internet. | Low |
| **D8** | §3.3.1 Gantt chart is "as of 13 July 2026". | Substantial work shipped after that date (suppliers, auto-reorder, staff management, invoice numbering, frontend restyle). | Low |
| **D9** | Figure 3.2 caption in the report is *Figure 3.2*. | The exported PNG for it is `diagrams/exports/figure-3-1.png` — the exports were generated **before** the Gantt page was added and the figures renumbered, so every export is off by one, and there is **no export for Figure 3.7 (Activity Diagram)**. | Medium (asset hygiene) |
| **D10** | §4.4 / §9.6: JWTs are signed with `SECRET_KEY`. | **The default `SECRET_KEY` is cryptographically too short.** `dev-insecure-change-me` is 22 bytes; RFC 7518 §3.2 requires an HMAC-SHA256 key of at least 32 bytes [46]. Running the test suite emits `InsecureKeyLengthWarning: The HMAC key is 22 bytes long, which is below the minimum recommended length of 32 bytes for SHA256`. Every token issued with the default key is signed below the standard's minimum. | **Medium** — harmless on a local demo, but the default must not survive into any shared deployment. Generating a key as §9.5 instructs produces 50 characters and clears the warning. Discovered by execution, not by inspection. |
| **D11** | §7.10: `todays_sales_total` is a decimal string. | When there are no sales today the value is `'0'`, not `'0.00'` — `DashboardView` seeds its `sum()` with the integer `0`, so the type of the response field depends on whether any sale exists. `total_available_stock_value` has the same shape (`'25060.00'` vs `'0'`). | **Low** — a client parsing with `Number()` is unaffected; one formatting to two decimals from the raw string is not. Fix: seed both sums with `Decimal("0")`. |

## 13.3 Implementation Observations (not report discrepancies)

| # | Observation |
|---|-------------|
| O1 | `Supplier.products_supplied` is a hand-entered integer, but `Product.supplier` now exists — the two can drift. It could be derived (`supplier.products.count()`); the model comment predates the FK and is now stale. |
| O2 | `PurchaseOrder.Status.CANCELLED` is defined but never set anywhere in the codebase. |
| O3 | `Product.available_quantity` counts batches with `quantity = 0`; `InventoryView` skips them. The totals agree, but the two code paths differ. |
| O4 | `GET /api/purchase-orders/` is exposed and tested but **never called by the frontend** — the UI reads the outstanding order through `ProductSerializer.open_purchase_order` instead. |
| O5 | `Customer.phone` is not unique, so the same buyer can be entered twice. (The KHAATA reference system makes phone unique for exactly this reason.) |
| O6 | JWT tokens are stored in `localStorage`, which is XSS-exposed. Acceptable for a local demo; noted in §9.6. |
| O7 | `TIME_ZONE = "UTC"` while the deployment context is Mumbai (IST). "Today's orders" and expiry boundaries roll over at 05:30 IST. Consider `Asia/Kolkata`. |
| O8 | Token lifetimes (8 h / 7 d) are described in-code as "generous because this is a local demo". |
| O9 | There is no path that returns stock to its batches, so an order cannot be cancelled or reversed. |
| O10 | `backend/health/` has an empty `migrations/` package and no models — correct, but worth knowing when reading the tree. |
| O11 | The running database is **not** the seeded dataset: it holds 8 products (including one named "Amul diamond"), 1 supplier and 2 users, against the seed's 7 / 6 / 5. This is the conditional-seed rule working as designed (§9.2) — entered data survives restarts — but it means a demo given from this machine will not match Appendix B. Run `seed_demo` to reset before a demonstration. |
| O12 | No product currently has `auto_reorder` enabled and there are no purchase orders, so the reorder feature is dormant in the live data. Its correctness rests on the eight auto-reorder tests, all of which pass. |

## 13.4 Features Documented but Not Implemented

1. Payment recording against an invoice (report §3.1.5 Steps 3–4; DFD L2 process 4.2;
   Figure 3.6 "Record payment"; Figure 3.7 "Record customer payment").
2. Automatic derivation of invoice `status` from `paid_amount`.
3. Server-side, date-ranged reporting (report §3.1.6 Steps 1–4).
4. Customer subscriptions and automatic order creation from them (§1.5.1, §3.1.3).
5. Delivery scheduling — dates, routes, assignees (§1.5.1).
6. The entire Compliance and Record module (§3.1.7) — document upload, organised record
   retrieval, audit export.
7. Expiry **alert generation** as a push mechanism (§1.5.1 item 3). Expiry status is computed
   and surfaced on screen, but nothing notifies anyone.

## 13.5 Features Implemented but Not Documented in the Report

1. **Supplier master** — full CRUD, rating, deletion guard. (Now §3.1.8, §7.5.)
2. **Purchase orders and automatic reordering** — threshold rule, duplicate suppression,
   automatic closure on receipt. (Now §3.1.8, §8.3.)
3. **Staff management** — owner-only roster, activation/deactivation, password reset,
   self-demotion and last-owner protections. (Now §3.1.1 note, §7.3, §8.6.)
4. **Alerts page** — five derived conditions with recommended actions. (Now §3.1.9.)
5. **Product SKU, description and photograph**, with `clear_image` semantics and orphan-file
   cleanup. (Now §6.3.3, §7.4.)
6. **Reorder levels and stock-status badge** (`in_stock` / `low_stock` / `out_of_stock`).
   (Now §6.3.3.)
7. **Invoice numbering** — `INV-<year>-<seq>`, yearly restart, collision retry, idempotence.
   (Now §8.5.)
8. **Cost-price confidentiality** — `purchase_price` withheld from staff. (Now §8.6.)
9. **Dashboard KPI role-gating** — monetary keys omitted for staff. (Now §7.10.)
10. **Dashboard analytical panels** — category rollup, seven-day series, expiring-soon,
    recent orders. (Now §3.1.6 note.)
11. **`/api/products/categories/`** — derived category list. (Now §7.4.)
12. **`/api/health/`** — public liveness probe. (Now §7.2.)
13. **Deletion guards** across products, suppliers and customers. (Now §8.7.)
14. **Django admin** as a full back-office, including a custom expiry-status filter.
    (Now §11.7.)
15. **`seed_demo`** management command with five accounts, six suppliers, seven products,
    fifteen batches, five customers, five orders and two invoices. (Now Appendix B.)
16. **JWT refresh interceptor** with single-flight de-duplication. (Now §8.8.)
17. **Test suite** — 97 tests. (Now §11.3.)
18. **Docker Compose stack** with health checks, conditional seeding and HMR polling.
    (Now Chapter 9.)
19. **`dairydesk-inventory/`** — a standalone HTML/CSS/JS inventory prototype, the visual
    source for the Stock Levels and Reports pages. Not part of the running application.

## 13.6 Diagrams That May Need Changes — **Awaiting Your Approval**

**No diagram has been altered.** The following are recommendations only. Please confirm which,
if any, you would like updated; each would be edited in
`diagrams/DairyDesk_Diagrams.drawio` and re-exported.

| Figure | Page in `.drawio` | Issue | Recommendation |
|--------|-------------------|-------|----------------|
| **Figure 3.2 — ER Diagram** | `Fig 3.2 ER Diagram` | Missing `Supplier` and `PurchaseOrder`; `Product` missing 7 fields; `Invoice` missing `number`, `created_at`; `User` missing `is_active` | Add both entities and the missing attributes; keep the "User is standalone" note, which is still accurate |
| **Figure 3.7 — Activity Diagram** | `Fig 3.7 Activity Diagram` | Deducts stock on *processed*; the code deducts at order creation. Also shows "Record customer payment", which has no API | Move the FIFO deduction box above "Create customer order", and either remove the payment step or mark it *(future release)* |
| **Figure 3.5 — DFD Level 2** | `Fig 3.5 DFD Level 2` | Process 4.2 "Record Payment" is not implemented; no supplier/purchase-order flow | Mark 4.2 as deferred; add "2.3 Raise Purchase Order" with a `D5 \| Suppliers and Purchase Orders` store |
| **Figure 3.4 — DFD Level 1** | `Fig 3.4 DFD Level 1` | No supplier/procurement sub-process; "Billing and Payments" overstates payments | Add a "6.0 Supplier and Procurement" process; rename 4.0 to "Billing" or annotate the payment flow as deferred |
| **Figure 3.6 — Use Case Diagram** | `Fig 3.6 Use Case Diagram` | Missing: manage staff, manage suppliers, view alerts, auto-reorder (system actor), export report. "Record payment" is shown but unimplemented | Add the five missing use cases; mark "Record payment" *(future release)* |
| **Figure 3.1 — Gantt Chart** | `Fig 3.1 Gantt Chart` | Stamped "as of 13 July 2026"; four phases have progressed since | Re-baseline to the current date and mark Module Development / Testing accordingly |
| **Figure 3.3 — DFD Level 0** | `Fig 3.3 DFD Level 0` | **No change needed** — accurate as drawn | — |
| **Exports** | `diagrams/exports/` | PNGs are off by one (`figure-3-1.png` is the ER diagram, i.e. Figure 3.2) and there is no export for Figure 3.7 | Re-export all seven pages with correct filenames |

## 13.7 Assumptions Made

1. **Which document is which.** The *Dairy Business Management System Report* was treated as
   the unfinished documentation and *KHAATA* as the completed template. Structure, heading
   numbering, the "Note / Status" callout style, the comparison-summary table (§2.6) and the
   bibliography format were taken from KHAATA.
2. **Chapters 1–3 are the report; Chapters 4–13 are new.** Original wording is preserved
   verbatim; every addition is either a marked callout or a new numbered section, so the
   report's own text can still be lifted out intact.
3. **No diagram was altered, and none was recreated in text.** Figures are referenced by
   number and source page only.
4. **§3.4.2 was deliberately left incomplete.** Updating it would have broken its stated
   correspondence with Figure 3.2. The complete schema is Chapter 6 instead.
5. **Literature survey extension.** §§2.2–2.4 and §2.6 were added because the completed
   template surveys four systems and ends with a comparison, while the unfinished report
   surveyed one. Feature and pricing figures are attributed to the vendors' published pages
   and flagged as requiring re-verification; the DairyDesk column was filled from the code,
   not from marketing claims.
6. **Version numbers** were taken from `requirements.txt` and `package.json`. Frontend
   entries use caret ranges, so the documented figure is the floor of the range.
7. **"Implemented" means present and exercised by a test or a wired-up page** — not
   production-hardened. §9.6 lists what production would additionally require.
8. **The Gantt chart's dates were taken at face value** (project start June 2026, "as of"
   13 July 2026) and not reconciled against commit timestamps.
9. **`dairydesk-inventory/`** was treated as a design prototype, not a deliverable
   application, based on the comment in `storeMock.js`.
10. **Deployment target** is assumed to be a single machine on the shop's premises, matching
    `PROJECT_SPEC.md`'s "run everything locally".
11. **No code was changed** while producing this document. Every discrepancy in §13.2 is
    reported, not fixed.
12. **Validation was static *and* dynamic.** The source was inspected, then the running stack
    was exercised: the full test suite was executed (97/97 pass) and every endpoint contract
    in Chapter 7 was called live and compared against this document (§13.1.1–§13.1.3). No
    documented contract failed. Two findings — D10 and D11 — were discovered only by
    execution and would not have surfaced from reading the code.
13. **The live database was read, not reshaped.** Verification used read-only calls plus two
    deliberately-failing writes (an over-quantity order and an empty basket), both of which
    are rejected before anything is written. No row in the working database was created,
    modified or deleted, and `seed_demo` was not run.
14. **Frontend versions are the resolved ones.** Where a caret range and the installed
    version differ (`vite`, `oxlint`), §13.1.3 records both.

---

# Bibliography

## Core Technologies

1. Python Software Foundation — *Python 3.13 Documentation*. <https://docs.python.org/3.13/>
2. Django Software Foundation — *Django 5.1 Documentation*. <https://docs.djangoproject.com/en/5.1/>
3. Encode / Django REST Framework — *Django REST Framework Documentation*. <https://www.django-rest-framework.org/>
4. Django Software Foundation — *Password Management in Django*. <https://docs.djangoproject.com/en/5.1/topics/auth/passwords/>
5. jazzband — *Simple JWT: A JSON Web Token Authentication Plugin for Django REST Framework*. <https://django-rest-framework-simplejwt.readthedocs.io/>
6. adamchainz — *django-cors-headers*. <https://github.com/adamchainz/django-cors-headers>
7. M. Jones, J. Bradley and N. Sakimura — *RFC 7519: JSON Web Token (JWT)*, IETF, May 2015. <https://datatracker.ietf.org/doc/html/rfc7519>
8. PostgreSQL Global Development Group — *PostgreSQL 16 Documentation*. <https://www.postgresql.org/docs/16/>
9. D. Varrazzo — *Psycopg 3 Documentation*. <https://www.psycopg.org/psycopg3/docs/>
10. Python Imaging Library contributors — *Pillow (PIL Fork) Documentation*. <https://pillow.readthedocs.io/>
11. S. Kumar — *python-dotenv*. <https://github.com/theskumar/python-dotenv>
12. Y. Shafranovich — *RFC 4180: Common Format and MIME Type for Comma-Separated Values (CSV) Files*, IETF, October 2005. <https://datatracker.ietf.org/doc/html/rfc4180>
13. A. Wiggins — *The Twelve-Factor App*. <https://12factor.net/>
14. Docker Inc. — *Docker Documentation*. <https://docs.docker.com/>
15. Docker Inc. — *Docker Compose Specification*. <https://docs.docker.com/compose/compose-file/>

## Domain and Literature Survey

16. MumbaikarNews — *Amul expands distribution network across Mumbai*. (As cited in the project's field-study background.)
17. CaptainBiz — *Dairy Management and Inventory Software*. <https://www.captainbiz.com/>
18. Vyapar App — *Official Website: India's #1 Business Accounting App*. <https://vyaparapp.in/>
19. Vyapar App — *Features*. <https://vyaparapp.in/features>
20. Vyapar App — *Pricing Plans*. <https://vyaparapp.in/pricing>
21. Marg ERP Ltd — *Official Website*. <https://www.margerp.com/>
22. Marg ERP Ltd — *Retail Billing Software Features*. <https://www.margerp.com/retail-billing-software>
23. Marg ERP Ltd — *About Us: Since 1992*. <https://www.margerp.com/about-us>
24. Zoho Inventory — *Online Inventory Management Software*. <https://www.zoho.com/inventory/>
25. Zoho Inventory — *Features*. <https://www.zoho.com/inventory/features/>
26. Zoho Inventory — *Pricing Plans*. <https://www.zoho.com/inventory/pricing/>

## Frontend Libraries

27. OpenJS Foundation — *Node.js 22 Documentation*. <https://nodejs.org/docs/latest-v22.x/api/>
28. Meta Open Source — *React Documentation*. <https://react.dev/>
29. Vite contributors — *Vite Documentation*. <https://vite.dev/>
30. Remix / React Router contributors — *React Router Documentation*. <https://reactrouter.com/>
31. Axios contributors — *Axios Documentation*. <https://axios-http.com/docs/intro>
32. Tailwind Labs — *Tailwind CSS Documentation*. <https://tailwindcss.com/docs>
33. Poimandres — *React Three Fiber Documentation*. <https://r3f.docs.pmnd.rs/>
34. Poimandres — *Drei: Useful Helpers for React Three Fiber*. <https://drei.docs.pmnd.rs/>
35. Three.js contributors — *Three.js Documentation*. <https://threejs.org/docs/>
36. Oxc Project — *oxlint*. <https://oxc.rs/docs/guide/usage/linter.html>

## Architecture, Patterns and Best Practices

37. R. T. Fielding — *Architectural Styles and the Design of Network-based Software Architectures*, Ph.D. dissertation, University of California, Irvine, 2000, Chapter 5: "Representational State Transfer (REST)". <https://ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm>
38. M. Jones and D. Hardt — *RFC 6750: The OAuth 2.0 Authorization Framework: Bearer Token Usage*, IETF, October 2012. <https://datatracker.ietf.org/doc/html/rfc6750>
39. M. Fowler — *Patterns of Enterprise Application Architecture*, Addison-Wesley, 2002. (Service Layer, Active Record, Data Transfer Object.)
40. PostgreSQL Global Development Group — *Explicit Locking: Row-Level Locks (`SELECT … FOR UPDATE`)*. <https://www.postgresql.org/docs/16/explicit-locking.html>
41. Institute of Chartered Accountants of India — *Ind AS 2: Inventories* (first-in, first-out cost formula). <https://www.icai.org/>
42. D. F. Ferraiolo and D. R. Kuhn — *Role-Based Access Controls*, in Proceedings of the 15th National Computer Security Conference, NIST, 1992. <https://csrc.nist.gov/projects/role-based-access-control>
43. OWASP Foundation — *OWASP Top Ten Web Application Security Risks*. <https://owasp.org/www-project-top-ten/>
44. OWASP Foundation — *Application Security Verification Standard (ASVS)*. <https://owasp.org/www-project-application-security-verification-standard/>
45. Django Software Foundation — *Security in Django* and *Deployment Checklist*. <https://docs.djangoproject.com/en/5.1/topics/security/>, <https://docs.djangoproject.com/en/5.1/howto/deployment/checklist/>
46. M. Jones — *RFC 7518: JSON Web Algorithms (JWA)*, IETF, May 2015, §3.2: "HMAC with SHA-2 Functions" (minimum key length for HS256). <https://datatracker.ietf.org/doc/html/rfc7518#section-3.2>
47. PyJWT contributors — *PyJWT Documentation* (the JWT implementation underlying Simple JWT, and the source of the `InsecureKeyLengthWarning` recorded in §13.2, D10). <https://pyjwt.readthedocs.io/>

## Project Documents

48. *Dairy Business Management System — Project Report* (Chapters 1–3), internal project document, 2026.
49. *Dairy Business Management System — Build Spec (Demo v1)*, `PROJECT_SPEC.md`, internal, 2026.
50. *KHAATA — Offline Digital Ledger & Kirana Store Management System*, Department of Information Technology, Sathaye College (Autonomous), 2026. *(Structural and formatting reference for this document.)*

---

# Appendix A: Environment Variable Reference

Every value has a working default in `docker-compose.yml`; `.env` is optional.

## PostgreSQL

| Variable | Default | Consumed by | Purpose |
|----------|---------|-------------|---------|
| `POSTGRES_DB` | `dairydesk` | compose, Django | Database name |
| `POSTGRES_USER` | `dairydesk` | compose, Django | Database user |
| `POSTGRES_PASSWORD` | `dairydesk` | compose, Django | Database password |
| `POSTGRES_PORT` | `5432` | compose | **Host** port PostgreSQL is published on |

## Django

| Variable | Default | Consumed by | Purpose |
|----------|---------|-------------|---------|
| `DB_HOST` | `localhost` | Django | Only used when Django runs on the host. The container always uses `db` |
| `DB_PORT` | `5432` | Django | As above; the container always uses `5432` |
| `SECRET_KEY` | `dev-insecure-change-me` | Django | Cryptographic signing key for sessions and JWTs. **Must be replaced outside local dev** — the default is 22 bytes, below RFC 7518 §3.2's 32-byte HMAC-SHA256 minimum [46], and the test suite warns about it (§13.2, D10) |
| `DEBUG` | `True` | Django | Debug mode; also gates media-file serving |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,backend` | Django | Comma-separated permitted Host headers |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | Django | Comma-separated browser origins allowed to call the API |

Generate a real secret key with:

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

## Docker Stack

| Variable | Default | Purpose |
|----------|---------|---------|
| `BACKEND_PORT` | `8000` | Host port for the API |
| `FRONTEND_PORT` | `5173` | Host port for the dev server |
| `SEED_DEMO` | `true` | Set `false` to stop the container seeding an empty database |

## Frontend (Vite)

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `http://localhost:8000` | Where the **browser** reaches the API — the published port, not the compose network |
| `VITE_USE_POLLING` | `1` (in compose) | Forces HMR file-watch polling; required for bind mounts on Windows/WSL2 |
| `VITE_HMR_CLIENT_PORT` | unset | Set to the same value as `FRONTEND_PORT` if the port is remapped, so HMR reconnects |

---

# Appendix B: Seeded Demo Data

`python manage.py seed_demo` clears the tables it owns and writes a realistic dataset. It is
run automatically on first startup, but only against a database with no users.

## Accounts

| Role | Username | Password | Notes |
|------|----------|----------|-------|
| Owner | `owner` | `owner123` | Priya Deshmukh; also a Django superuser |
| Staff | `staff` | `staff123` | Nikhil Jadhav |
| Owner | `rohit` | `rohit123` | Rohit Kadam |
| Staff | `sneha` | `sneha123` | Sneha Patil |
| Staff | `amit` | `amit123` | Amit Shirke — **seeded disabled**, so the Staff page has an account to re-enable |

## Data Volumes

| Entity | Count | Notes |
|--------|-------|-------|
| Suppliers | 6 | Ratings 3.2–4.8 |
| Products | 7 | Full Cream Milk, Toned Milk, Dahi (Curd), Paneer, Ghee, Chaas, Butter |
| Stock batches | 15 | Deliberate mix of fresh / ageing / expired so the 3D shelf shows all three colours |
| Customers | 5 | Mumbai addresses |
| Orders | 5 | 2 delivered, 1 processed, 2 pending |
| Order items | 11 | |
| Invoices | 2 | One paid, one partially paid — numbered from the same `next_invoice_number` generator the live flow uses |

---

# Appendix C: Glossary

| Term | Meaning |
|------|---------|
| **Ageing** | A batch within `AGEING_THRESHOLD_DAYS` (3) of its expiry date |
| **Auto-reorder** | The rule that raises a purchase order when stock falls to a product's reorder threshold |
| **Available quantity** | Sum of quantities across a product's non-expired batches |
| **Batch** | One delivery of one product, with its own quantity, cost and expiry date |
| **FIFO** | First-in, first-out — the oldest received batch is sold first |
| **HMR** | Hot Module Replacement; Vite's live-update mechanism |
| **JWT** | JSON Web Token; the signed credential returned at login |
| **KPI** | Key Performance Indicator; the figures on the dashboard tiles |
| **Owner** | The role with full access, including all financial data and staff management |
| **Purchase order** | Stock ordered *from* a supplier (as distinct from an *order*, sold *to* a customer) |
| **Reorder threshold** | The stock level at or below which a product counts as low |
| **SKU** | Stock-Keeping Unit; the unique code identifying a product |
| **Staff** | The restricted role: counter and stock work, no financial visibility |
| **Worst status** | The most severe expiry status among a product's batches; drives the shelf colour |

---

*End of document.*
