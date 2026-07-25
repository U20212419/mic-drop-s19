package com.twokb.micdrop.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.twokb.micdrop.dto.DiscordJudgingReminderResponse;
import com.twokb.micdrop.model.DiscordUser;
import com.twokb.micdrop.model.Round;
import com.twokb.micdrop.model.UserRoleType;
import com.twokb.micdrop.model.UserRound;

import net.dv8tion.jda.api.JDA;
import net.dv8tion.jda.api.entities.channel.concrete.TextChannel;
import net.dv8tion.jda.api.requests.restaction.MessageCreateAction;

@ExtendWith(MockitoExtension.class)
class DiscordBotServiceTests {

	@Mock
	private JDA jda;

	@Mock
	private SystemSettingService systemSetting;

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
	private DiscordBotService discordBotService;

	@Test
	void sendsGeneralReminderWithTimeAndPendingSongCounts() {
		Round round = new Round();
		round.setIdRound(20);
		round.setRoundNumber(2);

		DiscordUser firstJudge = judge(1, "111", "Alpha");
		DiscordUser secondJudge = judge(2, "222", "Beta");
		DiscordUser finishedJudge = judge(3, "333", "Gamma");

		when(systemSetting.getHostDiscordId()).thenReturn("host");
		when(jda.getTextChannelById("channel")).thenReturn(textChannel);
		when(roundService.getActiveRound()).thenReturn(round);
		when(userRoundService.getUserRoundsByRoundId(20))
			.thenReturn(List.of(judgeAssignment(firstJudge), judgeAssignment(secondJudge),
					judgeAssignment(finishedJudge)));
		when(submissionService.countPendingJudgeSubmissions(20, 1)).thenReturn(2L);
		when(submissionService.countPendingJudgeSubmissions(20, 2)).thenReturn(1L);
		when(submissionService.countPendingJudgeSubmissions(20, 3)).thenReturn(0L);
		when(textChannel.sendMessage(org.mockito.ArgumentMatchers.anyString())).thenReturn(messageAction);

		Instant deadline = Instant.now().plus(12, ChronoUnit.HOURS);
		DiscordJudgingReminderResponse response = discordBotService.sendJudgingReminder("channel", deadline, "host");

		ArgumentCaptor<String> messageCaptor = ArgumentCaptor.forClass(String.class);
		verify(textChannel).sendMessage(messageCaptor.capture());
		verify(messageAction).queue();

		String message = messageCaptor.getValue();
		assertThat(message).contains("Round 2 Judging Reminder");
		assertThat(message).contains("<t:" + deadline.getEpochSecond() + ":R>");
		assertThat(message).contains("<@111> - **2 songs**");
		assertThat(message).contains("<@222> - **1 song**");
		assertThat(message).doesNotContain("<@333>");
		assertThat(message).contains("Total remaining: 3 songs");
		assertThat(response.judgesMentioned()).isEqualTo(2);
		assertThat(response.songsRemaining()).isEqualTo(3);
	}

	private DiscordUser judge(Integer id, String discordId, String username) {
		DiscordUser user = new DiscordUser();
		user.setIdUser(id);
		user.setDiscordId(discordId);
		user.setUsername(username);
		return user;
	}

	private UserRound judgeAssignment(DiscordUser judge) {
		UserRound assignment = new UserRound();
		assignment.setUser(judge);
		assignment.setUserRole(UserRoleType.JUDGE);
		return assignment;
	}

}
