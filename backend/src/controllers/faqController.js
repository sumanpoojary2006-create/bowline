import AppSetting from '../models/AppSetting.js';
import { DEFAULT_FAQS, sanitizeFaqs } from '../utils/faqContent.js';

const FAQ_SETTING_KEY = 'website_faqs';
const FAQ_CONTENT_VERSION_KEY = 'website_faqs_content_version';
const FAQ_CONTENT_VERSION = 1;

const loadFaqs = async () => {
  const [setting, versionSetting] = await Promise.all([
    AppSetting.findOne({ key: FAQ_SETTING_KEY }).lean(),
    AppSetting.findOne({ key: FAQ_CONTENT_VERSION_KEY }).lean(),
  ]);

  if (Number(versionSetting?.value) !== FAQ_CONTENT_VERSION) {
    const restoredSetting = await AppSetting.findOneAndUpdate(
      { key: FAQ_SETTING_KEY },
      { value: DEFAULT_FAQS },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await AppSetting.findOneAndUpdate(
      { key: FAQ_CONTENT_VERSION_KEY },
      { value: FAQ_CONTENT_VERSION },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return restoredSetting.value;
  }

  return Array.isArray(setting?.value) ? setting.value : DEFAULT_FAQS;
};

export const getPublicFaqs = async (_req, res, next) => {
  try {
    res.json({ faqs: await loadFaqs() });
  } catch (error) {
    next(error);
  }
};

export const getAdminFaqs = async (_req, res, next) => {
  try {
    res.json({ faqs: await loadFaqs() });
  } catch (error) {
    next(error);
  }
};

export const updateFaqs = async (req, res, next) => {
  try {
    let faqs;
    try {
      faqs = sanitizeFaqs(req.body.faqs);
    } catch (error) {
      res.status(400);
      throw error;
    }

    const setting = await AppSetting.findOneAndUpdate(
      { key: FAQ_SETTING_KEY },
      { value: faqs },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ faqs: setting.value });
  } catch (error) {
    next(error);
  }
};

