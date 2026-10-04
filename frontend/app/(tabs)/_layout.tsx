import React, { useEffect } from "react";
import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { House, ChartBar, Bell, User } from "phosphor-react-native";

import { fonts, useTheme } from "@/src/theme";
import { usesNativeTabs } from "@/src/navigation";
import { isLang, useI18n } from "@/src/i18n";
import { useProfile } from "@/src/api/hooks";

export default function TabsLayout() {
  const { t, lang, setLang } = useI18n();
  const { colors: c } = useTheme();
  const { data: profile } = useProfile();

  // A language saved on the account wins over the device default (e.g. new device).
  useEffect(() => {
    if (profile && isLang(profile.language) && profile.language !== lang) {
      setLang(profile.language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.language]);

  if (usesNativeTabs) {
    const { NativeTabs } = require("expo-router/unstable-native-tabs");
    return (
      <NativeTabs>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="drop.fill" />
          <NativeTabs.Trigger.Label>{t("tabs.home")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="reports">
          <NativeTabs.Trigger.Icon sf="chart.bar.fill" />
          <NativeTabs.Trigger.Label>{t("tabs.reports")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="reminders">
          <NativeTabs.Trigger.Icon sf="bell.fill" />
          <NativeTabs.Trigger.Label>{t("tabs.reminders")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="profile">
          <NativeTabs.Trigger.Icon sf="person.fill" />
          <NativeTabs.Trigger.Label>{t("tabs.profile")}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.brandPrimary,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: {
          backgroundColor: c.surfaceSecondary,
          borderTopColor: c.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: fonts.bold, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ color, focused }) => (
            <House size={26} color={color} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t("tabs.reports"),
          tabBarIcon: ({ color, focused }) => (
            <ChartBar size={26} color={color} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: t("tabs.reminders"),
          tabBarIcon: ({ color, focused }) => (
            <Bell size={26} color={color} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color, focused }) => (
            <User size={26} color={color} weight={focused ? "fill" : "regular"} />
          ),
        }}
      />
    </Tabs>
  );
}
