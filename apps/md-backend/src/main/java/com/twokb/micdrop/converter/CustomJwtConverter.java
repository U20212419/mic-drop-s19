package com.twokb.micdrop.converter;

import java.util.List;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

import com.twokb.micdrop.repository.DiscordUserRepository;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class CustomJwtConverter implements Converter<Jwt, AbstractAuthenticationToken> {

	private final DiscordUserRepository discordUserRepository;

	@Override
	public AbstractAuthenticationToken convert(Jwt jwt) {
		// Estract the Discord ID from the JWT claims
		String discordId = jwt.getSubject();

		// Look up the user in the database using the Discord ID to get their global role
		String roleName = discordUserRepository.findByDiscordId(discordId)
			.map(user -> user.getGlobalRole().name())
			.orElse("USER"); // Default to USER role if not found

		// Create a new JwtAuthenticationToken with the appropriate authorities based on
		// the user's global role
		GrantedAuthority authority = new SimpleGrantedAuthority("ROLE_" + roleName);
		return new JwtAuthenticationToken(jwt, List.of(authority));
	}

}
