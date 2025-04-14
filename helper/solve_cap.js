import axios from "axios";
import colors from "colors/safe.js";
import "dotenv/config";
const API_KEY = process.env.API_KEY;
const SITE_KEY = process.env.SITE_KEY;
const PAGE_URL = "https://monad.fantasy.top";
//6Le0KwQrAAAAAFDABV6yW_RHaYZqjChaJAJaIkud
function log(msg, type = "info") {
  const timestamp = new Date().toLocaleTimeString();
  switch (type) {
    case "success":
      console.log(colors.green(`[${timestamp}] [✓] ${msg}`));
      break;
    case "custom":
      console.log(colors.magenta(`[${timestamp}] [*] ${msg}`));
      break;
    case "error":
      console.log(colors.red(`[${timestamp}] [✗] ${msg}`));
      break;
    case "warning":
      console.log(colors.yellow(`[${timestamp}] [!] ${msg}`));
      break;
    default:
      console.log(colors.blue(`[${timestamp}] [ℹ] ${msg}`));
  }
}

async function solveCaptcha() {
  try {
    log("[Captcha] Gửi yêu cầu đến 2Captcha...", "info");
    const submitResponse = await axios.post(
      "https://api.capsolver.com/createTask",
      {
        clientKey: API_KEY,
        task: {
          type: "AntiTurnstileTaskProxyLess",
          websiteURL: PAGE_URL,
          websiteKey: SITE_KEY,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (submitResponse.data.errorId !== 0) {
      throw new Error(`Lỗi khi gửi captcha: ${submitResponse.data.error_text}`);
    }

    const captchaId = submitResponse.data.taskId;
    log(`[Captcha] Captcha ID: ${captchaId}. Đang đợi kết quả...`, "custom");

    let solution = null;
    let waitTime = 20000;
    let maxAttempts = 3;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      const resultResponse = await axios.post(
        "https://api.capsolver.com/getTaskResult",

        {
          clientKey: API_KEY,
          taskId: captchaId,
        }
      );

      if (resultResponse.data.status === "ready") {
        solution = resultResponse.data.solution.token;
        log(`[Captcha] Captcha đã được giải thành công!`, "success");
        break;
      }

      if (resultResponse.data.request === "ERROR_CAPTCHA_UNSOLVABLE") {
        throw new Error("[Captcha] Captcha không thể giải!");
      }

      if (resultResponse.data.status !== "ready") {
        log(
          `[Captcha] Chưa có kết quả, thử lại sau ${waitTime / 1000}s...`,
          "warning"
        );
      } else {
        log(`[Captcha] Lỗi khác từ 2Captcha: ${resultResponse.data}`, "error");
      }

      waitTime = Math.min(waitTime + 2000, 25000);
    }

    if (!solution) {
      log(`[Captcha] Không có kết quả`, "error");
      return false;
    }
    return { data: solution };
  } catch (error) {
    log(`[Captcha] Lỗi solveCaptcha: ${error.message}`, "error");
    return false;
  }
}

export default solveCaptcha;
