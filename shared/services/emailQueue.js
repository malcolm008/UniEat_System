const { sendEmail } = require('./emailService');

class EmailQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.maxRetries = 3;
        this.retryDelay = 5000;
    }

    async add(emailData) {
        return new Promise((resolve) => {
            this.queue.push({
                ...emailData,
                resolve,
                attempts: 0,
                addedAt: new Date()
            });

            console.log(`📧 Email queued for ${emailData.to}. Queue size: ${this.queue.length}`);

            if (!this.processing) {
                this.process();
            }
        });
    }

    async process() {
        if (this.processing) return;
        this.processing = true;

        while (this.queue.length > 0) {
            const item = this.queue.shift();

            try {
                console.log(`📧 Sending email to ${item.to} (Attempt ${item.attempts + 1}/${this.maxRetries + 1})`);

                const result = await sendEmail(item.to, item.subject, item.html);

                if (result.success) {
                    console.log(`✅ Email sent successfully to ${item.to}`);
                    item.resolve({ success: true, messageId: result.messageId });
                } else {
                    throw new Error(result.error);
                }

            } catch (error) {
                console.error(`❌ Failed to send email to ${item.to}:`, error.message);

                if (item.attempts < this.maxRetries) {
                    // Re-queue with delay
                    item.attempts++;
                    console.log(`🔄 Re-queueing email to ${item.to} (Attempt ${item.attempts + 1}/${this.maxRetries + 1})`);

                    setTimeout(() => {
                        this.queue.unshift(item);
                        if (!this.processing) {
                            this.process();
                        }
                    }, this.retryDelay * (item.attempts + 1));

                    item.resolve({ success: false, error: error.message, queued: true });
                } else {
                    console.error(`💀 Failed to send email to ${item.to} after ${this.maxRetries + 1} attempts`);
                    item.resolve({ success: false, error: error.message, failed: true });
                }
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        this.processing = false;
        console.log('📧 Email queue processing complete');
    }

    getQueueStatus() {
        return {
            queueLength: this.queue.length,
            isProcessing: this.processing,
            pendingEmails: this.queue.map(item => ({
                to: item.to,
                attempts: item.attempts,
                addedAt: item.addedAt
            }))
        };
    }
}

const emailQueue = new EmailQueue();

module.exports = { emailQueue };