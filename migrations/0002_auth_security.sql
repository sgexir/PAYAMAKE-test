-- PAYAMAKE D1 Staging
-- Migration 0002: Authentication & Session Security
--
-- Scope:
--   Adds Layer 2 security storage for TOTP, recovery codes,
--   SMS/email OTP challenges, and authentication audit events.
-- Safety:
--   Does not alter, drop, or recreate existing tables.
--   Reuses the existing `admin_sessions` table from Migration 0001.
--   Does not insert credentials, TOTP secrets, recovery codes, or OTPs.

PRAGMA foreign_keys = ON;

CREATE TABLE admin_security (
    admin_id INTEGER PRIMARY KEY,
    totp_enabled INTEGER NOT NULL DEFAULT 0
        CHECK (totp_enabled IN (0, 1)),
    totp_secret_encrypted TEXT,
    totp_enabled_at TEXT,
    failed_login_count INTEGER NOT NULL DEFAULT 0
        CHECK (failed_login_count >= 0),
    locked_until TEXT,
    security_version INTEGER NOT NULL DEFAULT 1
        CHECK (security_version >= 1),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id)
        REFERENCES admins(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE admin_recovery_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    code_hash TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id)
        REFERENCES admins(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX idx_admin_recovery_codes_admin_id
    ON admin_recovery_codes(admin_id);

CREATE TABLE otp_challenges (
    id TEXT PRIMARY KEY,
    admin_id INTEGER NOT NULL,
    purpose TEXT NOT NULL
        CHECK (
            purpose IN (
                'login',
                'step_up',
                'password_change',
                'email_change',
                'phone_change',
                'two_factor_disable',
                'admin_create',
                'admin_role_change',
                'recovery'
            )
        ),
    channel TEXT NOT NULL
        CHECK (channel IN ('sms', 'email')),
    target TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0
        CHECK (attempts >= 0),
    max_attempts INTEGER NOT NULL DEFAULT 5
        CHECK (max_attempts > 0),
    expires_at TEXT NOT NULL,
    consumed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id)
        REFERENCES admins(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX idx_otp_challenges_admin_id
    ON otp_challenges(admin_id);

CREATE INDEX idx_otp_challenges_expires_at
    ON otp_challenges(expires_at);

CREATE INDEX idx_otp_challenges_admin_purpose
    ON otp_challenges(admin_id, purpose);

CREATE TABLE auth_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    event_type TEXT NOT NULL
        CHECK (
            event_type IN (
                'login_success',
                'login_failed',
                'logout',
                'totp_setup_started',
                'totp_enabled',
                'totp_failed',
                'totp_disabled',
                'recovery_code_used',
                'otp_sent',
                'otp_verified',
                'otp_failed',
                'session_created',
                'session_revoked',
                'account_locked',
                'account_unlocked',
                'password_changed',
                'security_change'
            )
        ),
    method TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id)
        REFERENCES admins(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX idx_auth_events_admin_id
    ON auth_events(admin_id);

CREATE INDEX idx_auth_events_created_at
    ON auth_events(created_at);

CREATE INDEX idx_auth_events_event_type
    ON auth_events(event_type);
