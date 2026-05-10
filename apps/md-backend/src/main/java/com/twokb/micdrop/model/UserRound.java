package com.twokb.micdrop.model;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "user_round")
@Data
@NoArgsConstructor
public class UserRound {

	@EmbeddedId
	private UserRoundId id;

	@ManyToOne
	@MapsId("userId")
	@JoinColumn(name = "discord_user_id_user")
	private DiscordUser user;

	@ManyToOne
	@MapsId("roundId")
	@JoinColumn(name = "round_id_round")
	private Round round;

	@Column(name = "user_role")
	private UserRoleType userRole;

	@Column(name = "group_number", nullable = false)
	private Integer groupNumber;

}
