package com.twokb.micdrop.model;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "refresh_token")
@Data
@NoArgsConstructor
public class RefreshToken {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "id_token")
	private Integer idToken;

	@Column(name = "discord_user_discord_id", nullable = false, unique = true)
	private String discordId;

	@Column(name = "token_hash", nullable = false)
	private String tokenHash;

	@Column(name = "expiry_date", nullable = false)
	private Instant expiryDate;

}
