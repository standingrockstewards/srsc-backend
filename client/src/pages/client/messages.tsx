/**
 * Property Messages — client ↔ Standing Rock threaded conversation
 * Client sees only their property thread(s).
 * Staff (admin/supervisor) sees all property threads.
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { MessageSquare, Send, ChevronDown } from "lucide-react";
import { AppLayout } from "@/components/app-layout";

const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#222";

function fmtTime(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday " + date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PropertyMessages() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isStaff = user?.role === "admin" || user?.role === "supervisor";

  // Fetch properties scoped to this user
  const { data: properties = [] } = useQuery<any[]>({
    queryKey: ["/api/properties/mine", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      if (isStaff) {
        const r = await apiRequest("GET", "/api/properties");
        return r.json();
      }
      const r = await apiRequest("GET", `/api/properties/mine?clientUserId=${user.id}`);
      return r.json();
    },
    enabled: !!user?.id,
  });

  const [activePropId, setActivePropId] = useState<number | null>(null);
  const property = useMemo(() =>
    properties.find((p: any) => p.id === activePropId) ?? properties[0],
    [properties, activePropId]
  );

  // Fetch messages for active property
  const { data: messages = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/property-messages", property?.id],
    queryFn: async () => {
      if (!property?.id) return [];
      const r = await apiRequest("GET", `/api/property-messages?propertyId=${property.id}`);
      return r.json();
    },
    enabled: !!property?.id,
    refetchInterval: 30000,
  });

  // Auto-scroll to bottom
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Compose
  const [body, setBody] = useState("");
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!body.trim()) throw new Error("Message cannot be empty");
      const res = await apiRequest("POST", "/api/property-messages", {
        propertyId: property?.id,
        fromUserId: user?.id,
        body: body.trim(),
      });
      return res.json();
    },
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["/api/property-messages", property?.id] });
    },
  });

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMutation.mutate();
    }
  }

  return (
    <AppLayout title="Messages" subtitle="Property conversations">
    <div className="flex" style={{ height: "calc(100vh - 120px)", overflow: "hidden" }}>
      {/* Property sidebar (if multiple or staff) */}
      {(properties.length > 1 || isStaff) && (
        <div className="w-56 flex-shrink-0 flex flex-col overflow-y-auto"
          style={{ background: "#141414", borderRight: `1px solid ${CARD_BORDER}` }}>
          <div className="px-3 pt-4 pb-2">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#555" }}>
              {isStaff ? "All Properties" : "Your Properties"}
            </span>
          </div>
          {properties.map((p: any) => (
            <button key={p.id}
              onClick={() => setActivePropId(p.id)}
              className="flex flex-col items-start px-3 py-2.5 text-sm text-left transition-colors hover:bg-white/5"
              style={{
                background: property?.id === p.id ? "rgba(192,90,67,0.1)" : "transparent",
                borderLeft: `3px solid ${property?.id === p.id ? TERRACOTTA : "transparent"}`,
                color: property?.id === p.id ? CREAM : "#888",
              }}>
              <span className="font-semibold text-xs">{p.nickname}</span>
              {isStaff && <span className="text-xs" style={{ color: "#555" }}>{p.ownerName}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Message thread */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {/* Thread header */}
        <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
          style={{ background: "#141414", borderBottom: `1px solid ${CARD_BORDER}` }}>
          <MessageSquare size={16} style={{ color: TERRACOTTA }} />
          <div>
            <div className="font-bold text-sm" style={{ color: CREAM }}>
              {property ? property.nickname : "Select a property"}
            </div>
            {property && (
              <div className="text-xs" style={{ color: "#666" }}>
                {isStaff ? property.ownerName : "Standing Rock Stewardship Co."}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {!property ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageSquare size={36} style={{ color: "#333", margin: "0 auto 12px" }} />
                <p style={{ color: "#666" }}>Select a property to view messages.</p>
              </div>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: CARD_BG }} />)}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <MessageSquare size={36} style={{ color: "#333", margin: "0 auto 12px" }} />
                <p className="font-semibold" style={{ color: "#666" }}>No messages yet</p>
                <p className="text-sm mt-1" style={{ color: "#444" }}>
                  Start a conversation with your Standing Rock team below.
                </p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg: any) => {
                const isMe = msg.from_user_id === user?.id;
                const isStaffSender = msg.sender_role === "admin" || msg.sender_role === "supervisor";
                return (
                  <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-xs md:max-w-md lg:max-w-lg space-y-1 ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                      {/* Sender label */}
                      <div className="flex items-center gap-1.5 px-1">
                        {!isMe && (
                          <span className="text-xs font-bold" style={{ color: isStaffSender ? TERRACOTTA : SAGE }}>
                            {isStaffSender ? msg.sender_name ?? "Standing Rock" : msg.sender_name}
                          </span>
                        )}
                        <span className="text-xs" style={{ color: "#555" }}>{fmtTime(msg.sent_at)}</span>
                      </div>
                      {/* Bubble */}
                      <div className="rounded-2xl px-4 py-2.5"
                        style={{
                          background: isMe ? `${TERRACOTTA}22` : "#252525",
                          border: `1px solid ${isMe ? TERRACOTTA + "44" : CARD_BORDER}`,
                          borderBottomRightRadius: isMe ? 4 : undefined,
                          borderBottomLeftRadius: !isMe ? 4 : undefined,
                        }}>
                        <p className="text-sm leading-relaxed" style={{ color: CREAM }}>{msg.body}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Composer */}
        {property && (
          <div className="flex-shrink-0 px-4 py-3" style={{ borderTop: `1px solid ${CARD_BORDER}`, background: "#141414" }}>
            <div className="flex items-end gap-2">
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder={`Message ${isStaff ? property.ownerName : "Standing Rock"}…`}
                className="flex-1 rounded-xl px-3 py-2.5 text-sm resize-none outline-none"
                style={{ background: "#1e1e1e", border: `1px solid ${CARD_BORDER}`, color: CREAM }}
              />
              <button
                onClick={() => sendMutation.mutate()}
                disabled={!body.trim() || sendMutation.isPending}
                className="rounded-xl p-2.5 transition-opacity flex-shrink-0"
                style={{ background: TERRACOTTA, color: "#fff", opacity: (!body.trim() || sendMutation.isPending) ? 0.5 : 1 }}>
                <Send size={16} />
              </button>
            </div>
            <p className="text-xs mt-1.5" style={{ color: "#444" }}>
              Press Enter to send · Shift+Enter for new line
            </p>
          </div>
        )}
      </div>
    </div>
    </AppLayout>
  );
}
