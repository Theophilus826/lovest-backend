const Banner = require("../model/Banner");
const cloudinary = require("../config/Cloudinary");

// ==========================================
// ADMIN - GET ALL BANNERS
// ==========================================

const getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find()
      .sort({ order: 1, createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: banners.length,
      data: banners,
    });
  } catch (error) {
    console.error("GET ALL BANNERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch banners",
      error: error.message,
    });
  }
};

// ==========================================
// PUBLIC - GET ACTIVE BANNERS
// ==========================================

const getActiveBanners = async (req, res) => {
  try {
    const banners = await Banner.find({
      active: true,
    }).sort({
      order: 1,
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      data: banners,
    });
  } catch (error) {
    console.error("GET ACTIVE BANNERS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch banners",
    });
  }
};

// ==========================================
// ADMIN - CREATE BANNER
// ==========================================

const createBanner = async (req, res) => {
  try {
    const {
      title,
      subtitle,
      buttonText,
      link,
      active,
      order,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Banner title is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Banner image is required",
      });
    }

    const banner = await Banner.create({
      title: title.trim(),

      subtitle: subtitle || "",

      buttonText:
        buttonText || "Shop Now",

      link: link || "/",

      active:
        active !== "false" &&
        active !== false,

      order: Number(order) || 0,

      image: req.file.path,

      imagePublicId: req.file.filename,
    });

    return res.status(201).json({
      success: true,
      message: "Banner created successfully",
      data: banner,
    });
  } catch (error) {
    console.error("CREATE BANNER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create banner",
      error: error.message,
    });
  }
};

// ==========================================
// ADMIN - UPDATE BANNER
// ==========================================

const updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(
      req.params.id
    );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    if (req.body.title !== undefined) {
      if (!req.body.title.trim()) {
        return res.status(400).json({
          success: false,
          message: "Banner title cannot be empty",
        });
      }

      banner.title = req.body.title.trim();
    }

    if (req.body.subtitle !== undefined) {
      banner.subtitle = req.body.subtitle;
    }

    if (req.body.buttonText !== undefined) {
      banner.buttonText = req.body.buttonText;
    }

    if (req.body.link !== undefined) {
      banner.link = req.body.link;
    }

    if (req.body.order !== undefined) {
      banner.order = Number(req.body.order) || 0;
    }

    if (req.body.active !== undefined) {
      banner.active =
        req.body.active === "true" ||
        req.body.active === true;
    }

    // ==========================================
    // NEW IMAGE
    // ==========================================

    if (req.file) {
      if (banner.imagePublicId) {
        try {
          await cloudinary.uploader.destroy(
            banner.imagePublicId
          );
        } catch (cloudinaryError) {
          console.error(
            "FAILED TO DELETE OLD BANNER IMAGE:",
            cloudinaryError
          );
        }
      }

      banner.image = req.file.path;
      banner.imagePublicId =
        req.file.filename;
    }

    await banner.save();

    return res.status(200).json({
      success: true,
      message: "Banner updated successfully",
      data: banner,
    });
  } catch (error) {
    console.error("UPDATE BANNER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update banner",
      error: error.message,
    });
  }
};

// ==========================================
// ADMIN - DELETE BANNER
// ==========================================

const deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(
      req.params.id
    );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    if (banner.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(
          banner.imagePublicId
        );
      } catch (cloudinaryError) {
        console.error(
          "FAILED TO DELETE BANNER IMAGE:",
          cloudinaryError
        );
      }
    }

    await banner.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Banner deleted successfully",
    });
  } catch (error) {
    console.error("DELETE BANNER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete banner",
    });
  }
};

// ==========================================
// ADMIN - TOGGLE BANNER
// ==========================================

const toggleBannerStatus = async (req, res) => {
  try {
    const banner = await Banner.findById(
      req.params.id
    );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: "Banner not found",
      });
    }

    banner.active = !banner.active;

    await banner.save();

    return res.status(200).json({
      success: true,
      message: banner.active
        ? "Banner activated successfully"
        : "Banner deactivated successfully",
      data: banner,
    });
  } catch (error) {
    console.error(
      "TOGGLE BANNER ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update banner status",
    });
  }
};

module.exports = {
  getAllBanners,
  getActiveBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerStatus,
};