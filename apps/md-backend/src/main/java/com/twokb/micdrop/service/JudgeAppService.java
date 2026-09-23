package com.twokb.micdrop.service;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.twokb.micdrop.dto.JudgeAppDTO;
import com.twokb.micdrop.exception.NotFoundException;
import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.model.JudgeApp;
import com.twokb.micdrop.model.Round;
import com.twokb.micdrop.model.UserRoleType;
import com.twokb.micdrop.model.UserRound;
import com.twokb.micdrop.repository.JudgeAppRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class JudgeAppService {

	private final DiscordUserService discordUserService;

	private final RoundService roundService;

	private final UserRoundService userRoundService;

	private final JudgeAppRepository judgeAppRepository;

	@Transactional(readOnly = true)
	public JudgeAppDTO getJudgeAppByDiscordId(String discordId) {
		DiscordUser user = discordUserService.getUserByDiscordId(discordId);

		return Optional.ofNullable(user.getJudgeApp())
			.map(app -> new JudgeAppDTO(app.getFavArtists(), app.getLeastFavArtists(), app.getFavGenres(),
					app.getLeastFavGenres(), app.getJudgingStyle(), app.getSafePickCriteria(), app.getGivingBonus(),
					app.getBannedArtists(), app.getAmountPreference()))
			.orElseThrow(() -> new NotFoundException("No judge application found for the specified user."));
	}

	@Transactional
	public void submitOrUpdateJudgeApp(String discordId, JudgeAppDTO dto) {
		DiscordUser user = discordUserService.getUserByDiscordId(discordId);

		JudgeApp app = user.getJudgeApp();
		if (app == null) {
			app = new JudgeApp();
		}
		else {
			// Don't allow updates if the user is assigned to the current active round
			Optional<Round> activeRoundOpt = roundService.findActiveRound();

			if (activeRoundOpt.isPresent()) {
				List<UserRound> userRounds = userRoundService
					.findUserRoundsByRoundIdAndDiscordId(activeRoundOpt.get().getIdRound(), discordId);

				if (userRounds.stream().anyMatch(ur -> ur.getUserRole() == UserRoleType.JUDGE)) {
					throw new IllegalStateException(
							"Cannot update judge application while assigned as a judge to the current active round.");
				}
			}
		}

		app.setFavArtists(dto.favArtists());
		app.setLeastFavArtists(dto.leastFavArtists());
		app.setFavGenres(dto.favGenres());
		app.setLeastFavGenres(dto.leastFavGenres());
		app.setJudgingStyle(dto.judgingStyle());
		app.setSafePickCriteria(dto.safePickCriteria());
		app.setGivingBonus(dto.givingBonus());
		app.setBannedArtists(dto.bannedArtists());
		app.setAmountPreference(dto.amountPreference());

		user.setJudgeApp(judgeAppRepository.save(app));
	}

}
