function triggerWebhook(task, eventType) {
  // Simulate an external API call (e.g., Slack, Gmail, Google Drive)
  console.log(`\n[INTEGRATION SERVICE] Triggering webhook for event: '${eventType}'`);
  console.log(`[INTEGRATION SERVICE] Payload:`, JSON.stringify({
    event: eventType,
    taskId: task.id,
    taskText: task.text,
    timestamp: new Date().toISOString()
  }, null, 2));
  console.log(`[INTEGRATION SERVICE] Webhook sent successfully.\n`);
}

module.exports = {
  triggerWebhook
};
