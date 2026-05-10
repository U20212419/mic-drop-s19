package com.twokb.micdrop.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "judge_app")
@Data
@NoArgsConstructor
public class JudgeApp {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "id_app")
	private Integer idApp;

	@Column(name = "fav_artists", nullable = false, length = 5000)
	private String favArtists;

	@Column(name = "least_fav_artists", nullable = false, length = 5000)
	private String leastFavArtists;

	@Column(name = "fav_genres", nullable = false, length = 5000)
	private String favGenres;

	@Column(name = "least_fav_genres", nullable = false, length = 5000)
	private String leastFavGenres;

	@Column(name = "judging_style", nullable = false, length = 5000)
	private String judgingStyle;

	@Column(name = "safe_pick_criteria", nullable = false, length = 5000)
	private String safePickCriteria;

	@Column(name = "giving_bonus", nullable = false)
	private Boolean givingBonus;

	@Column(name = "banned_artists", nullable = false, length = 5000)
	private String bannedArtists;

	@Column(name = "amount_preference", nullable = false)
	private JudgingAmountPreference amountPreference;

}
