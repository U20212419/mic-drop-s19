package com.twokb.micdrop.config;

import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;
import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonParser;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;
import tools.jackson.databind.module.SimpleModule;

@Configuration
public class SanitizerConfig {

	@Bean
	public JsonMapperBuilderCustomizer jsonCustomizer() {
		return builder -> {
			SimpleModule module = new SimpleModule();

			module.addDeserializer(String.class, new ValueDeserializer<String>() {
				@Override
				public String deserialize(JsonParser p, DeserializationContext ctxt) throws JacksonException {
					String value = p.getValueAsString();

					if (value == null) {
						return null;
					}

					PolicyFactory policy = new HtmlPolicyBuilder().allowCommonBlockElements()
						.allowCommonInlineFormattingElements()
						.allowElements("a")
						.allowAttributes("href")
						.onElements("a")
						.allowStandardUrlProtocols()
						.requireRelNofollowOnLinks()
						.toFactory();

					return policy.sanitize(value);
				}
			});

			builder.addModule(module);
		};
	}

}
