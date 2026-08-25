-- PAYAMAKE D1 Staging
-- Migration 0001: Identity & Access
--
-- Scope:
--   Creates the Layer 1 authentication/authorization schema only.
-- Safety:
--   Does not alter, drop, or migrate the existing `leads` table.
--   Does not insert an initial admin or any credentials.

PRAGMA foreign_keys = ON;

CREATE TABLE admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
        CHECK (is_active IN (0, 1)),
    last_login_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_roles (
    admin_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    PRIMARY KEY (admin_id, role_id),
    FOREIGN KEY (admin_id)
        REFERENCES admins(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    FOREIGN KEY (role_id)
        REFERENCES roles(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id)
        REFERENCES roles(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    FOREIGN KEY (permission_id)
        REFERENCES permissions(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE TABLE admin_sessions (
    id TEXT PRIMARY KEY,
    admin_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TEXT,
    FOREIGN KEY (admin_id)
        REFERENCES admins(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

CREATE INDEX idx_admin_roles_role_id
    ON admin_roles(role_id);

CREATE INDEX idx_role_permissions_permission_id
    ON role_permissions(permission_id);

CREATE INDEX idx_admin_sessions_admin_id
    ON admin_sessions(admin_id);

CREATE INDEX idx_admin_sessions_expires_at
    ON admin_sessions(expires_at);
