package com.twokb.micdrop.model;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "discord_user")
@Data
@NoArgsConstructor
public class DiscordUser {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "id_user")
	private Integer idUser;

	@Column(name = "discord_id", unique = true, nullable = false)
	private String discordId;

	@Column(name = "username", nullable = false)
	private String username;

	@Column(name = "status", nullable = false)
	private ContestantStatus status;

	@Column(name = "global_role", nullable = false)
	private GlobalRoleType globalRole;

	@OneToOne(cascade = CascadeType.ALL)
	@JoinColumn(name = "judge_app_id_app", referencedColumnName = "id_app")
	private JudgeApp judgeApp;

	@Transient
	private boolean isHost;

}
