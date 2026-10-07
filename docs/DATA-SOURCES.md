# M63 — Directory of Evidence & Data Sources

This document registers all external evidence providers integrated or planned for M63.

---

## 1. Adzuna Job Market API

| Attribute | Specification |
| :--- | :--- |
| **Provider** | **Adzuna** |
| **Purpose** | Real-world job vacancy discovery, compensation evidence, hiring employer data, and current posting activity. |
| **Coverage** | 11+ countries including India (`in`), United Kingdom (`gb`), United States (`us`), Germany (`de`), Canada (`ca`), Australia (`au`), Singapore (`sg`). |
| **Access Method** | REST HTTP API (`https://api.adzuna.com/v1/api/jobs/{country}/search/{page}`) |
| **Authentication** | Server-side Application ID (`ADZUNA_APP_ID`) and Application Key (`ADZUNA_APP_KEY`). |
| **Rate Limits** | Varies by developer tier (typically 25–50 requests/min). Monitored with HTTP 429 backoff handling. |
| **Data Freshness** | Near real-time; cached with a 1-hour TTL in M63 (`EVIDENCE_CACHE_TTL_JOBS_SEC=3600`). |
| **Known Limitations** | Does not cover 100% of unlisted jobs; salary ranges are sometimes predicted by aggregator algorithms (clearly flagged as `PARTIAL` when predicted). |
| **Terms / Attribution** | *"Jobs powered by Adzuna"* with direct link to canonical redirect URL. |
| **Production Status** | **REAL** (Active implementation; credentials configured via `.env`). |

---

## 2. National Career Service (NCS) Portal

| Attribute | Specification |
| :--- | :--- |
| **Provider** | **Ministry of Labour & Employment, Government of India** |
| **Purpose** | Authoritative public career reference portal, government opportunities, and public sector vocational pathways. |
| **Coverage** | India national and state-level jurisdictions. |
| **Access Method** | Public portal reference resolver & verified directory links (`https://www.ncs.gov.in`). |
| **Authentication** | Publicly accessible portal links; zero secret leakage. |
| **Rate Limits** | N/A (Direct link fallbacks & cached directories). |
| **Data Freshness** | Structural / Daily updates; cached with a 24-hour TTL (`EVIDENCE_CACHE_TTL_MARKET_SEC=86400`). |
| **Known Limitations** | Full automated REST API requires formal inter-ministry MoUs; currently operates as authoritative verified link fallback. |
| **Terms / Attribution** | Official portal of the Government of India. |
| **Production Status** | **FALLBACK** (Active fallback provider when live aggregators are unconfigured or down). |

---

## 3. Ministry of Statistics & Programme Implementation (MoSPI) & O*NET

| Attribute | Specification |
| :--- | :--- |
| **Provider** | **MoSPI Labour Surveys & O*NET 28.0 Structural Reference** |
| **Purpose** | Structural occupational taxonomy normalization, skill hierarchy mapping, and macroeconomic demand baselines. |
| **Coverage** | Global standardized occupational taxonomy (SOC & NCO-2015). |
| **Access Method** | Ingested reference datasets and public API (`https://www.onetonline.org`). |
| **Authentication** | Open access public domain data. |
| **Rate Limits** | Unlimited cached access. |
| **Data Freshness** | Periodic annual revisions; cached with a 7-day TTL (`EVIDENCE_CACHE_TTL_STRUCTURAL_SEC=604800`). |
| **Known Limitations** | Structural reference only; does NOT represent live current vacancies. |
| **Terms / Attribution** | U.S. Department of Labor & Government of India public data guidelines. |
| **Production Status** | **REAL** (Active taxonomy normalization skeleton). |

---

## 4. Regional Hyper-Local STEAM Registries

| Attribute | Specification |
| :--- | :--- |
| **Provider** | **State Pollution Control Boards (TNPCB), MSME Clusters, Regional Incubation Cells** |
| **Purpose** | Hyper-local problem statement matching, industrial effluent monitoring, precision engineering apprenticeships. |
| **Coverage** | Tamil Nadu regional industrial corridors (e.g. Tiruppur, Coimbatore, Vellore). |
| **Access Method** | Curated audited datasets with direct public reference links. |
| **Authentication** | Public domain environmental and MSME datasets. |
| **Rate Limits** | N/A. |
| **Data Freshness** | Audited regional updates. |
| **Known Limitations** | Coverage expands region-by-region; requires verified local institutional partnerships. |
| **Terms / Attribution** | State Government & Industry Association disclosures. |
| **Production Status** | **REAL** (Active regional pilot). |

---

## 5. Automated Unit Test Fixtures

| Attribute | Specification |
| :--- | :--- |
| **Provider** | **Vitest Test Suite Fixtures (`tests/evidence/*.test.ts`)** |
| **Purpose** | Verification of parsing edge cases, missing data handling, timeout resiliency, and deduplication logic. |
| **Coverage** | Isolated synthetic JSON payloads. |
| **Access Method** | In-memory mock objects. |
| **Authentication** | None. |
| **Production Status** | **TEST FIXTURE** (Strictly isolated in `/tests`; NEVER loaded into production databases or catalogs). |
