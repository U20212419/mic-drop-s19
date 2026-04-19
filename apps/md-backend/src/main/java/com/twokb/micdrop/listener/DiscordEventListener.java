package com.twokb.micdrop.listener;

import org.springframework.stereotype.Component;

import com.twokb.micdrop.repository.SystemSettingsRepository;
import com.twokb.micdrop.service.DiscordUserService;

import lombok.RequiredArgsConstructor;
import net.dv8tion.jda.api.events.message.react.MessageReactionAddEvent;
import net.dv8tion.jda.api.events.message.react.MessageReactionRemoveEvent;
import net.dv8tion.jda.api.hooks.ListenerAdapter;

@Component
@RequiredArgsConstructor
public class DiscordEventListener extends ListenerAdapter {

	private final DiscordUserService discordUserService;

	private final SystemSettingsRepository systemSettingsRepository;

	@Override
	public void onMessageReactionAdd(MessageReactionAddEvent event) {
		// Ignore reactions from bots
		if (event.getUser() != null && event.getUser().isBot()) {
			return;
		}

		// Ignore reactions that are not the specific emoji
		if (!event.getEmoji().getName().equals("☠️")) {
			return;
		}

		// Verify message ID and exact emoji
		systemSettingsRepository.findById("signup_message_id").ifPresent(settings -> {
			// Check if the reaction is on the correct message
			if (!event.getMessageId().equals(settings.getValue())) {
				return;
			}

			String discordId = event.getUserId();
			String username = event.getUser().getName();

			discordUserService.registerContestant(discordId, username);

			// Add contestant role to user in Discord
			systemSettingsRepository.findById("contestant_role_id").ifPresent(roleSettings -> {
				String contestantRoleId = roleSettings.getValue();

				if (event.isFromGuild() && event.getMember() != null) {
					event.getGuild()
						.addRoleToMember(event.getMember(), event.getGuild().getRoleById(contestantRoleId))
						.queue();
				}
			});
		});
	}

	@Override
	public void onMessageReactionRemove(MessageReactionRemoveEvent event) {
		// Ignore reactions from bots
		if (event.getUser() != null && event.getUser().isBot()) {
			return;
		}

		// Ignore reactions that are not the specific emoji
		if (!event.getEmoji().getName().equals("☠️")) {
			return;
		}

		// Verify message ID and exact emoji
		systemSettingsRepository.findById("signup_message_id").ifPresent(settings -> {
			// Check if the reaction is on the correct message
			if (!event.getMessageId().equals(settings.getValue())) {
				return;
			}

			String discordId = event.getUserId();

			if (discordUserService.unregisterContestant(discordId)) {
				systemSettingsRepository.findById("contestant_role_id").ifPresent(roleSettings -> {
					String contestantRoleId = roleSettings.getValue();

					if (event.isFromGuild() && event.getMember() != null) {
						event.getGuild()
							.removeRoleFromMember(event.getMember(), event.getGuild().getRoleById(contestantRoleId))
							.queue();
					}
				});

			}
		});
	}

}
