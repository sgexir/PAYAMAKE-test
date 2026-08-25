-- PAYAMAKE D1 Staging
-- Migration 0002: Authentication Security & MFA
-- Layer 1: Identity & Access
--
-- Security notes:
-- * TOTP secrets MUST be encrypted by the Worker before storage.
-- * OTPs and recovery codes MUST be stored as hashes, never plaintext.
-- * OTP challenges are single-use via consumed_at and bounded by attempts/max_attempts.
-- * This migration does not alter, drop, or recreate existing tables.

PRAGMA foreign_keys = ON;

CREATE TABLE mfa_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER NOT NULL,
    method_type TEXT NOT NULL
        CHECK (method_type IN ('totp', 'email_otp', 'sms_otp')),
    secret_encrypted TEXT,
    destination_masked TEXT,
    is_primary INTEGER NOT NULL DEFAULT 0
        CHECK (is_primary IN (0, 1)),
    is_verified INTEGER NOT NULL DEFAULT 0
        CHECK (is_verified IN (0, 1)),
    is_enabled INTEGER NOT NULL DEFAULT 1
        CHECK (is_enabled IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified_at TEXT,
    FOREIGN KEY (admin_id)
        REFERENCES admins(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CHECK (
        (method_type = 'totp' AND secret_encrypted IS NOT NULL)
        OR
        (method_type IN ('email_otp', 'sms_otp') AND destination_masked IS NOT NULL)
    )
);

CREATE TABLE otp_challenges (
    id TEXT PRIMARY KEY,
    admin_id INTEGER NOT NULL,
    method_id INTEGER NOT NULL,
    code_hash TEXT NOT NULL,
    purpose TEXT NOT NULL
        CHECK (purpose IN ('login', 'step_up', 'password_reset')),
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
        ON UPDATE CASCADE,
    FOREIGN KEY (method_id)
        REFERENCES mfa_methods(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE recovery_codes (
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

CREATE TABLE login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id INTEGER,
    email TEXT,
    ip_address TEXT,
    user_agent TEXT,
    stage TEXT NOT NULL
        CHECK (stage IN (
            'password_failed',
            'password_success',
            'mfa_failed',
            'mfa_success',
            'locked'
        )),
    success INTEGER NOT NULL
        CHECK (success IN (0, 1)),
    failure_reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id)
        REFERENCES admins(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);

CREATE INDEX idx_mfa_methods_admin_id
    ON mfa_methods(admin_id);

CREATE INDEX idx_mfa_methods_type
    ON mfa_methods(method_type);

CREATE INDEX idx_otp_challenges_admin_id
    ON otp_challenges(admin_id);

CREATE INDEX idx_otp_challenges_expires_at
    ON otp_challenges(expires_at);

CREATE INDEX idx_otp_challenges_method_id
    ON otp_challenges(method_id);

CREATE INDEX idx_recovery_codes_admin_id
    ON recovery_codes(admin_id);

CREATE INDEX idx_login_attempts_admin_id
    ON login_attempts(admin_id);

CREATE INDEX idx_login_attempts_email
    ON login_attempts(email);

CREATE INDEX idx_login_attempts_ip
    ON login_attempts(ip_address);

CREATE INDEX idx_login_attempts_created_at
    ON login_attempts(created_at);

-- At most one primary MFA method per admin.
CREATE UNIQUE INDEX uq_mfa_methods_primary_admin
    ON mfa_methods(admin_id)
    WHERE is_primary = 1;

-- Prevent duplicate email/SMS MFA destinations for the same admin and method type.
CREATE UNIQUE INDEX uq_mfa_methods_admin_type_destination
    ON mfa_methods(admin_id, method_type, destination_masked)
    WHERE destination_masked IS NOT NULL;

-- Prevent duplicate recovery-code hashes for one admin.
CREATE UNIQUE INDEX uq_recovery_codes_admin_hash
    ON recovery_codes(admin_id, code_hash);
