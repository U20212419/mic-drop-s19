DROP TABLE IF EXISTS submission CASCADE;
DROP TABLE IF EXISTS user_round CASCADE;
DROP TABLE IF EXISTS round CASCADE;
DROP TABLE IF EXISTS discord_user CASCADE;
DROP TABLE IF EXISTS judge_app CASCADE;
DROP TABLE IF EXISTS refresh_token CASCADE;
DROP TABLE IF EXISTS system_setting CASCADE;

DROP TYPE IF EXISTS contestant_status CASCADE;
DROP TYPE IF EXISTS global_role_type CASCADE;
DROP TYPE IF EXISTS user_role_type CASCADE;
DROP TYPE IF EXISTS judging_amount_preference CASCADE;

CREATE TYPE contestant_status AS ENUM ('active', 'inactive', 'eliminated', 'not_contestant', 'did_not_submit');
CREATE TYPE global_role_type AS ENUM ('admin', 'staff', 'user');
CREATE TYPE user_role_type AS ENUM ('contestant', 'judge');
CREATE TYPE judging_amount_preference AS ENUM ('more', 'less', 'no_preference');

CREATE CAST (varchar AS contestant_status) WITH INOUT AS IMPLICIT;
CREATE CAST (varchar AS global_role_type) WITH INOUT AS IMPLICIT;
CREATE CAST (varchar AS user_role_type) WITH INOUT AS IMPLICIT;
CREATE CAST (varchar AS judging_amount_preference) WITH INOUT AS IMPLICIT;

-- -----------------------------------------------------
-- Table `discord_user`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS discord_user (
	id_user SERIAL PRIMARY KEY,
	discord_id VARCHAR(50) NOT NULL UNIQUE,
	username VARCHAR(50) NOT NULL,
	status contestant_status NULL,
	global_role global_role_type NOT NULL,
	judge_app_id_app INTEGER NULL,
	CONSTRAINT fk_discord_user_judge_app
		FOREIGN KEY (judge_app_id_app)
		REFERENCES judge_app (id_app)
		ON DELETE NO ACTION
		ON UPDATE NO ACTION,
);

CREATE INDEX fk_discord_user_judge_app_idx ON discord_user (judge_app_id_app);
CREATE INDEX idx_discord_user_status ON discord_user (status);
CREATE INDEX idx_discord_user_global_role ON discord_user (global_role);

INSERT INTO discord_user (discord_id, username, status, global_role)
VALUES ('282323469553631233', '2kb', 'not_contestant', 'admin');

-- -----------------------------------------------------
-- Table `round`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS round (
	id_round SERIAL PRIMARY KEY,
	round_number INTEGER NOT NULL UNIQUE,
	active BOOLEAN NOT NULL,
	group_count INTEGER NOT NULL,
	submissions_open BOOLEAN NOT NULL,
	elimination_amount INTEGER NULL
);

CREATE INDEX idx_round_active ON round (active);

-- -----------------------------------------------------
-- Table `user_round`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS user_round (
	discord_user_id_user INTEGER NOT NULL,
	round_id_round INTEGER NOT NULL,
	user_role user_role_type NOT NULL,
	group_number INTEGER NOT NULL,
	PRIMARY KEY (discord_user_id_user, round_id_round),
	CONSTRAINT fk_user_round_discord_user
		FOREIGN KEY (discord_user_id_user)
		REFERENCES discord_user (id_user)
		ON DELETE NO ACTION
		ON UPDATE NO ACTION,
	CONSTRAINT fk_user_round_round
		FOREIGN KEY (round_id_round)
		REFERENCES round (id_round)
		ON DELETE NO ACTION
		ON UPDATE NO ACTION
);

CREATE INDEX fk_user_round_discord_user_idx ON user_round (discord_user_id_user);
CREATE INDEX fk_user_round_round_idx ON user_round (round_id_round);
CREATE INDEX idx_user_round_user_role ON user_round (user_role);
CREATE INDEX idx_user_round_group_number ON user_round (group_number);

-- -----------------------------------------------------
-- Table `submission`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS submission (
	id_submission SERIAL PRIMARY KEY,
	id_contestant INTEGER NOT NULL,
	id_judge INTEGER NOT NULL,
	id_round INTEGER NOT NULL,
	sub_link VARCHAR(200) NOT NULL,
	score NUMERIC(4, 2) NULL,
	review VARCHAR(5000) NULL,
	title VARCHAR(200) NULL,
	artist VARCHAR(200) NULL,
	submitted_at TIMESTAMPTZ NOT NULL,
	CONSTRAINT check_score_valid
		CHECK (score >=0 AND score <= 10 AND score % 0.25 = 0),
	CONSTRAINT fk_user_round_id_contestant
		FOREIGN KEY (id_contestant, id_round)
		REFERENCES user_round (discord_user_id_user, round_id_round)
		ON DELETE NO ACTION
		ON UPDATE NO ACTION,
	CONSTRAINT fk_user_round_id_judge
		FOREIGN KEY (id_judge, id_round)
		REFERENCES user_round (discord_user_id_user, round_id_round)
		ON DELETE NO ACTION
		ON UPDATE NO ACTION
);

CREATE INDEX fk_submission_contestant_idx ON submission (id_contestant, id_round);
CREATE INDEX fk_submission_judge_idx ON submission (id_judge, id_round);

-- -----------------------------------------------------
-- Table `system_setting`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS system_setting (
	setting_key VARCHAR(50) PRIMARY KEY,
	setting_value VARCHAR(100) NOT NULL
);

INSERT INTO system_setting (setting_key, setting_value)
VALUES ('signup_message_id', 'N/A'),
('contestant_role_id', 'N/A'),
('season_host_id', '282323469553631233');

-- -----------------------------------------------------
-- Table `judge_app`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS judge_app (
	id_app SERIAL PRIMARY KEY,
	fav_artists VARCHAR(5000) NOT NULL,
	least_fav_artists VARCHAR(5000) NOT NULL,
	fav_genres VARCHAR(5000) NOT NULL,
	least_fav_genres VARCHAR(5000) NOT NULL,
	judging_style VARCHAR(5000) NOT NULL,
	safe_pick_criteria VARCHAR(5000) NOT NULL,
	giving_bonus BOOLEAN NOT NULL,
	banned_artists VARCHAR(5000) NOT NULL,
	amount_preference judging_amount_preference NOT NULL
);

-- -----------------------------------------------------
-- Table `refresh_tokens`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_token (
	id_token SERIAL PRIMARY KEY,
	discord_user_discord_id VARCHAR(50) NOT NULL UNIQUE,
	token_hash VARCHAR(255) NOT NULL,
	expiry_date TIMESTAMP NOT NULL,
	CONSTRAINT fk_refresh_token_discord_user
		FOREIGN KEY (discord_user_discord_id)
		REFERENCES discord_user (discord_id)
		ON DELETE NO ACTION
		ON UPDATE NO ACTION
);

CREATE INDEX idx_refresh_token_token_hash ON refresh_token USING HASH (token_hash);