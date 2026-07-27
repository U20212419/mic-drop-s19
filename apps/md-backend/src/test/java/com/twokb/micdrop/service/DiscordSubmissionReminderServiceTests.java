package com.twokb.micdrop.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.model.Round;
import com.twokb.micdrop.model.SystemSetting;
import com.twokb.micdrop.model.UserRoleType;
import com.twokb.micdrop.model.UserRound;

import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.entities.channel.concrete.TextChannel;
import net.dv8tion.jda.api.requests.restaction.MessageCreateAction;

@ExtendWith(MockitoExtension.class)
class DiscordSubmissionReminderServiceTests {

	@Mock
	private JDA jda;

	@Mock
	private SystemSettingService systemSettingService;

	@Mock
	private RoundService roundService;

	@Mock
	private UserRoundService userRoundService;

	@Mock
	private SubmissionService submissionService;

	@Mock
	private TextChannel textChannel;

	@Mock
	private MessageCreateAction messageAction;

	@InjectMocks
	private DiscordSubmissionReminderService reminderService;

	private final Map<String, String> settings = new HashMap<>();

	@BeforeEach
	void setUpSettings() {
		when(systemSettingService.getSetting(anyString()))
			.thenAnswer(invocation -> Optional.ofNullable(settings.get(invocation.getArgument(0))));
		when(systemSettingService.setInternalSetting(anyString(), anyString())).thenAnswer(invocation -> {
			String key = invocation.getArgument(0);
			String value = invocation.getArgument(1);
			settings.put(key, value);
			return new SystemSetting(key, value);
		});
	}

	@Test
	void sendsOnlyTheCurrentThresholdAndDoesNotSendItTwice() {
		Instant now = Instant.parse("2026-07-25T12:00:00Z");
		Instant deadline = now.plusSeconds(5 * 60 * 60);
		settings.put("submission_reminder_channel_id", "channel");
		settings.put("submission_reminder_deadline", deadline.toString());
		settings.put("submission_reminder_enabled", "true");

		Round round = new Round();
		round.setIdRound(20);
		round.setRoundNumber(2);
		round.setSubmissionsOpen(true);

		UserRound judge = assignment(user(1, "111", "Judge"), UserRoleType.JUDGE, 1);
		UserRound pendingContestant = assignment(user(2, "222", "Alpha"), UserRoleType.CONTESTANT, 1);
		UserRound finishedContestant = assignment(user(3, "333", "Beta"), UserRoleType.CONTESTANT, 1);

		when(roundService.getActiveRound()).thenReturn(round);
		when(userRoundService.getUserRoundsByRoundId(20))
			.thenReturn(List.of(judge, pendingContestant, finishedContestant));
		when(submissionService.countSubmittedSongs(20, 2)).thenReturn(0L);
		when(submissionService.countSubmittedSongs(20, 3)).thenReturn(1L);
		when(jda.getTextChannelById("channel")).thenReturn(textChannel);
		when(textChannel.sendMessage(anyString())).thenReturn(messageAction);

		reminderService.sendDueReminder(now);
		reminderService.sendDueReminder(now.plusSeconds(60));

		ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
		verify(textChannel, times(1)).sendMessage(messageCaptor.capture());
		assertThat(messageCaptor.getValue()).contains("Automatic 6-hour reminder")
			.contains("Round 2 Submission Reminder")
			.contains("<t:" + deadline.getEpochSecond() + ":R>");

		assertThat(settings.get("submission_reminder_state"))
			.isEqualTo("20|" + deadline.getEpochSecond() + "|24.0,12.0,6.0");
	}

	private DiscordUser user(Integer id, String discordId, String username) {
		DiscordUser user = new DiscordUser();
		user.setIdUser(id);
		user.setDiscordId(discordId);
		user.setUsername(username);
		return user;
	}

	private UserRound assignment(DiscordUser user, UserRoleType role, Integer groupNumber) {
		UserRound assignment = new UserRound();
		assignment.setUser(user);
		assignment.setUserRole(role);
		assignment.setGroupNumber(groupNumber);
		return assignment;
	}

}
