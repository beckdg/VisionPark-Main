const { sendWelcomeEmail } = require("../emailVerification/providers/brevo.provider");
const { logger } = require("../../common/logger");

class ProvisioningService {
  async sendWelcomeCredentials({ user, temporaryPassword, role }) {
    try {
      await sendWelcomeEmail({
        toEmail: user.email,
        recipientName: user.name,
        role,
        temporaryPassword,
      });
    } catch (error) {
      logger.error("Welcome email failed after user provisioning", {
        module: "provisioning.service",
        userId: String(user._id),
        email: user.email,
        role,
        message: error?.message,
      });
      throw error;
    }
  }
}

module.exports = {
  ProvisioningService,
};
