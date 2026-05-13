"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Settings, Save, RefreshCw, AlertCircle, Loader2, Lock, Send, Bot } from "lucide-react";
import { useSession } from "next-auth/react";

interface SystemSetting {
  settingKey: string;
  settingValue: string;
}

export default function SettingsPage() {
  const { data: session, status: authStatus } = useSession();

  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [signupChannelId, setSignupChannelId] = useState("");
  const [isSendingSignup, setIsSendingSignup] = useState(false);

  const isHost = session?.user?.host;

  useEffect(() => {
    if (authStatus === "authenticated") {
      fetchSettings();
    }
  }, [authStatus]);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/system-settings");

      // Sort settings alphabetically by settingKey ascending
      res.data.sort((a: SystemSetting, b: SystemSetting) =>
        a.settingKey.localeCompare(b.settingKey, undefined, { sensitivity: "base" }),
      );
      setSettings(res.data);
    } catch (error: any) {
      // Error handled by interceptor
    } finally {
      setIsLoading(false);
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

          <div className="bg-[#2B2D31] border border-[#1E1F22] rounded-xl p-5 max-w-lg">
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
                className="flex-1 bg-[#1E1F22] border border-[#35373C] text-[#DBDEE1] rounded-md px-3 py-2 outline-none focus:border-emerald-500 text-sm transition-colors"
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
        </div>
      )}
    </div>
  );
}
