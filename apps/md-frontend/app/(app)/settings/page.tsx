"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import api from "@/lib/axios";
import {
  Settings,
  Save,
  RefreshCw,
  AlertCircle,
  Loader2,
  Lock,
  Send,
  Bot,
  BellRing,
  Clock,
  CalendarClock,
  Users,
  Hourglass,
} from "lucide-react";
import { useSession } from "next-auth/react";

interface SystemSetting {
  settingKey: string;
  settingValue: string;
}

interface SubmissionReminderConfig {
  channelId: string;
  deadline: string | null;
  enabled: boolean;
  reminderHours: number[];
}

const toLocalDateTimeInput = (isoDate: string | null) => {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

export default function SettingsPage() {
  const { data: session, status: authStatus } = useSession();

  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [signupChannelId, setSignupChannelId] = useState("");
  const [isSendingSignup, setIsSendingSignup] = useState(false);
  const [reminderChannelId, setReminderChannelId] = useState("");
  const [judgingDeadline, setJudgingDeadline] = useState("");
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [submissionReminderChannelId, setSubmissionReminderChannelId] = useState("");
  const [submissionDeadline, setSubmissionDeadline] = useState("");
  const [submissionReminderHours, setSubmissionReminderHours] = useState("");
  const [submissionRemindersEnabled, setSubmissionRemindersEnabled] = useState(false);
  const [isSavingSubmissionReminders, setIsSavingSubmissionReminders] = useState(false);

  const isHost = session?.user?.host;

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchSettings();
      if (isHost) {
        fetchSubmissionReminderSchedule();
      }
    }
  }, [authStatus, isHost]);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/system-settings");

      // Sort settings alphabetically by settingKey ascending
      const visibleSettings = res.data.filter(
        (setting: SystemSetting) => !setting.settingKey.startsWith("submission_reminder_"),
      );
      visibleSettings.sort((a: SystemSetting, b: SystemSetting) =>
        a.settingKey.localeCompare(b.settingKey, undefined, { sensitivity: "base" }),
      );
      setSettings(visibleSettings);
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubmissionReminderSchedule = async () => {
    try {
      const res = await api.get<SubmissionReminderConfig>("/bot/submission-reminder-schedule");
      setSubmissionReminderChannelId(res.data.channelId === "N/A" ? "" : res.data.channelId);
      setSubmissionDeadline(toLocalDateTimeInput(res.data.deadline));
      setSubmissionRemindersEnabled(res.data.enabled);
      if (res.data.reminderHours && res.data.reminderHours.length > 0) {
        setSubmissionReminderHours(res.data.reminderHours.join(", "));
      } else {
        setSubmissionReminderHours("");
      }
    } catch (error: any) {
      // Error handled by interceptor
    }
  };

  const handleUpdateValue = (key: string, newValue: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.settingKey === key ? { ...s, settingValue: newValue } : s)),
    );
  };

  const saveSetting = async (setting: SystemSetting) => {
    try {
      setSavingKey(setting.settingKey);
      await api.put(`/system-settings/${setting.settingKey}`, setting.settingValue, {
        headers: { "Content-Type": "text/plain" },
      });

      toast.success("Setting updated successfully.", {
        description: `The setting ${setting.settingKey} has been updated.`,
        closeButton: true,
      });
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setSavingKey(null);
    }
  };

  const handleSendSignupMessage = async () => {
    if (!signupChannelId) {
      toast.error("Channel ID required.", {
        description: "Please enter a valid Discord channel ID.",
        closeButton: true,
      });
      return;
    }

    try {
      setIsSendingSignup(true);

      await api.post("/bot/send-signup-message", { channelId: signupChannelId });

      toast.success("Signup message sent!", {
        description: `The signup message has been sent to channel with ID ${signupChannelId}.`,
        closeButton: true,
      });

      setSignupChannelId("");
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsSendingSignup(false);
    }
  };

  const handleSendJudgingReminder = async () => {
    if (!reminderChannelId.trim() || !judgingDeadline) {
      toast.error("Channel and deadline required.", {
        description: "Enter a Discord channel ID and the judging deadline.",
        closeButton: true,
      });
      return;
    }

    const deadline = new Date(judgingDeadline);
    if (Number.isNaN(deadline.getTime()) || deadline <= new Date()) {
      toast.error("Invalid deadline.", {
        description: "The judging deadline must be in the future.",
        closeButton: true,
      });
      return;
    }

    try {
      setIsSendingReminder(true);
      const res = await api.post("/bot/send-judging-reminder", {
        channelId: reminderChannelId.trim(),
        deadline: deadline.toISOString(),
      });

      toast.success("Judging reminder sent!", {
        description: `Round ${res.data.roundNumber}: ${res.data.judgesMentioned} judges mentioned with ${res.data.songsRemaining} songs remaining.`,
        closeButton: true,
      });
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsSendingReminder(false);
    }
  };

  const handleSaveSubmissionReminders = async () => {
    if (
      !submissionReminderChannelId.trim() ||
      !submissionDeadline ||
      !submissionReminderHours.trim()
    ) {
      toast.error("Missing fields.", {
        description: "Enter the Discord channel, submission deadline, and reminder hours.",
        closeButton: true,
      });
      return;
    }

    const deadline = new Date(submissionDeadline);
    if (Number.isNaN(deadline.getTime()) || deadline <= new Date()) {
      toast.error("Invalid deadline.", {
        description: "The submission deadline must be in the future.",
        closeButton: true,
      });
      return;
    }

    const hoursArray = submissionReminderHours
      .split(",")
      .map((h) => h.trim())
      .filter((h) => h !== "")
      .map(Number);

    if (hoursArray.some(Number.isNaN) || hoursArray.some((h) => h <= 0)) {
      toast.error("Invalid reminder hours.", {
        description:
          "Please enter a comma-separated list of positive integers for the reminder hours.",
        closeButton: true,
      });
      return;
    }

    try {
      setIsSavingSubmissionReminders(true);
      const res = await api.put<SubmissionReminderConfig>("/bot/submission-reminder-schedule", {
        channelId: submissionReminderChannelId.trim(),
        deadline: deadline.toISOString(),
        reminderHours: hoursArray,
      });
      setSubmissionRemindersEnabled(res.data.enabled);
      setSubmissionReminderHours(res.data.reminderHours.join(", "));
      toast.success("Automatic submission reminders enabled!", {
        description: `Contestants still missing songs will be pinged at ${res.data.reminderHours.join("h, ")}h before the deadline.`,
        closeButton: true,
      });
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsSavingSubmissionReminders(false);
    }
  };

  const handleDisableSubmissionReminders = async () => {
    try {
      setIsSavingSubmissionReminders(true);
      const res = await api.delete<SubmissionReminderConfig>("/bot/submission-reminder-schedule");
      setSubmissionRemindersEnabled(res.data.enabled);
      toast.success("Automatic submission reminders disabled.", { closeButton: true });
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsSavingSubmissionReminders(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#5865F2]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#5865F2]" />
            System Settings
          </h1>
          <p className="text-[#80848E] text-sm mt-1">
            Configure global parameters for the MicDrop platform.
          </p>
        </div>
        <button
          onClick={fetchSettings}
          className="p-2 text-[#80848E] hover:text-white transition-colors"
          title="Refresh settings"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {settings.map((setting) => (
          <div
            key={setting.settingKey}
            className="bg-[#2B2D31] border border-[#1E1F22] rounded-xl p-5 flex flex-col justify-between hover:border-[#35373C] transition-all"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#80848E] uppercase tracking-wider">
                  Setting Key
                </label>
                <span title="Keys cannot be changed" className="flex items-center">
                  <Lock className="w-3 h-3 text-[#4E5058]" />
                </span>
              </div>
              <h3 className="text-white font-mono text-sm bg-[#1E1F22] px-2 py-1 rounded inline-block">
                {setting.settingKey}
              </h3>

              <div className="pt-2">
                <label className="block text-xs font-bold text-[#80848E] uppercase mb-2">
                  Value
                </label>
                <input
                  type="text"
                  maxLength={100}
                  disabled={!isHost}
                  value={setting.settingValue}
                  onChange={(e) => handleUpdateValue(setting.settingKey, e.target.value)}
                  className="w-full bg-[#1E1F22] border border-[#1E1F22] text-[#DBDEE1] rounded-md px-3 py-2 outline-none focus:border-[#5865F2] transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end">
              <button
                onClick={() => saveSetting(setting)}
                disabled={savingKey === setting.settingKey || !isHost}
                className="bg-[#5865F2] hover:bg-[#4752C4] text-white px-6 py-2 rounded-md text-xs font-medium flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingKey === setting.settingKey ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Save className="w-3 h-3" />
                )}
                {savingKey === setting.settingKey ? "Saving..." : "Save Change"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {settings.length === 0 && (
        <div className="bg-[#2B2D31] rounded-xl border border-dashed border-[#4E5058] p-12 text-center">
          <AlertCircle className="w-12 h-12 text-[#4E5058] mx-auto mb-4" />
          <p className="text-[#80848E]">No system settings found in the database.</p>
        </div>
      )}

      {/* Host Actions Section */}
      {isHost && (
        <div className="pt-8 border-t border-[#35373C] space-y-5">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-emerald-400" />
              Discord Bot Operations
            </h2>
            <p className="text-[#80848E] text-sm mt-1">
              Direct controls for the MicDrop Discord Bot. Restricted to Season Host.
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-5xl">
            <div className="bg-[#2B2D31] border border-[#1E1F22] rounded-xl p-5">
              <h3 className="text-white font-semibold mb-1">Send Signup Message</h3>
              <p className="text-xs text-[#80848E] mb-4">
                Trigger the bot to send the official Season 19 signup message and reaction button.
              </p>

              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Target Channel ID"
                  value={signupChannelId}
                  onChange={(e) => setSignupChannelId(e.target.value)}
                  className="flex-1 min-w-0 bg-[#1E1F22] border border-[#35373C] text-[#DBDEE1] rounded-md px-3 py-2 outline-none focus:border-emerald-500 text-sm transition-colors"
                />
                <button
                  onClick={handleSendSignupMessage}
                  disabled={isSendingSignup || !signupChannelId.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isSendingSignup ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {isSendingSignup ? "Dispatching..." : "Send to Channel"}
                </button>
              </div>
            </div>

            {/* Judging Reminder Section */}
            <div className="bg-[#2B2D31] border border-[#1E1F22] rounded-xl p-5">
              <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
                <BellRing className="w-4 h-4 text-[#5865F2]" />
                Send Judging Reminder
              </h3>
              <p className="text-xs text-[#80848E] mb-4">
                Post a general reminder for the active round, mentioning judges with pending songs.
              </p>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Target Channel ID"
                  value={reminderChannelId}
                  onChange={(e) => setReminderChannelId(e.target.value)}
                  className="w-full bg-[#1E1F22] border border-[#35373C] text-[#DBDEE1] rounded-md px-3 py-2 outline-none focus:border-[#5865F2] text-sm transition-colors"
                />

                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#80848E] pointer-events-none" />
                  <input
                    type="datetime-local"
                    aria-label="Judging deadline"
                    value={judgingDeadline}
                    onChange={(e) => setJudgingDeadline(e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#35373C] text-[#DBDEE1] rounded-md pl-10 pr-3 py-2 outline-none focus:border-[#5865F2] text-sm transition-colors scheme-dark"
                  />
                </div>

                <button
                  onClick={handleSendJudgingReminder}
                  disabled={isSendingReminder || !reminderChannelId.trim() || !judgingDeadline}
                  className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white px-5 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSendingReminder ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <BellRing className="w-4 h-4" />
                  )}
                  {isSendingReminder ? "Dispatching..." : "Send Judging Reminder"}
                </button>
              </div>
            </div>

            {/* Submission Reminder Section */}
            <div className="bg-[#2B2D31] border border-[#1E1F22] rounded-xl p-5 xl:col-span-2">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  Automatic “Yet to Submit” Pings
                </h3>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    submissionRemindersEnabled
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-[#1E1F22] text-[#80848E]"
                  }`}
                >
                  {submissionRemindersEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
              <p className="text-xs text-[#80848E] mb-4">
                Ping contestants who still owe songs at specific configured hours before the active
                round&apos;s submission deadline.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Target Channel ID"
                  value={submissionReminderChannelId}
                  onChange={(e) => setSubmissionReminderChannelId(e.target.value)}
                  className="w-full bg-[#1E1F22] border border-[#35373C] text-[#DBDEE1] rounded-md px-3 py-2 outline-none focus:border-amber-500 text-sm transition-colors"
                />

                <div className="relative">
                  <CalendarClock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#80848E] pointer-events-none" />
                  <input
                    type="datetime-local"
                    aria-label="Submission deadline"
                    value={submissionDeadline}
                    onChange={(e) => setSubmissionDeadline(e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#35373C] text-[#DBDEE1] rounded-md pl-10 pr-3 py-2 outline-none focus:border-amber-500 text-sm transition-colors scheme-dark"
                  />
                </div>

                <div className="relative">
                  <Hourglass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#80848E] pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Reminder hours (e.g. 24, 12, 6, 1)"
                    title="Comma-separated list of hours before deadline to send pings"
                    value={submissionReminderHours}
                    onChange={(e) => setSubmissionReminderHours(e.target.value)}
                    className="w-full bg-[#1E1F22] border border-[#35373C] text-[#DBDEE1] rounded-md pl-10 pr-3 py-2 outline-none focus:border-amber-500 text-sm transition-colors"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleSaveSubmissionReminders}
                  disabled={
                    isSavingSubmissionReminders ||
                    !submissionReminderChannelId.trim() ||
                    !submissionDeadline ||
                    !submissionReminderHours.trim()
                  }
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white px-5 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingSubmissionReminders ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CalendarClock className="w-4 h-4" />
                  )}
                  Save & Enable Schedule
                </button>

                {submissionRemindersEnabled && (
                  <button
                    onClick={handleDisableSubmissionReminders}
                    disabled={isSavingSubmissionReminders}
                    className="bg-[#4E5058] hover:bg-[#5D6069] text-white px-5 py-2 rounded-md text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Disable
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
