package com.twokb.micdrop.dto;

import com.twokb.micdrop.model.JudgingAmountPreference;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record JudgeAppDTO(
	@NotBlank
	@Size(max = 5000, message = "Text is too long (max 5000 characters)")
	String favArtists,
	@NotBlank
	@Size(max = 5000, message = "Text is too long (max 5000 characters)")
	String leastFavArtists,
	@NotBlank
	@Size(max = 5000, message = "Text is too long (max 5000 characters)")
	String favGenres,
	@NotBlank
	@Size(max = 5000, message = "Text is too long (max 5000 characters)")
	String leastFavGenres,
	@NotBlank
	@Size(max = 5000, message = "Text is too long (max 5000 characters)")
	String judgingStyle,
	@NotBlank
	@Size(max = 5000, message = "Text is too long (max 5000 characters)")
	String safePickCriteria,
	@NotNull Boolean givingBonus,
	@NotBlank
	@Size(max = 5000, message = "Text is too long (max 5000 characters)")
	String bannedArtists,
	@NotNull JudgingAmountPreference amountPreference
) {}
