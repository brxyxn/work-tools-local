package main

import (
	"context"
	"embed"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/brxyxn/work-tools-local/internal/services"
	"github.com/brxyxn/work-tools-local/internal/storage"
	"github.com/wailsapp/wails/v3/pkg/application"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	if err := run(); err != nil {
		slog.Error("Work Tools stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	databasePath, err := storage.DefaultPath()
	if err != nil {
		return err
	}
	logPath, closeLog := configureLogging()
	defer closeLog()

	store, storageErr := storage.Open(context.Background(), databasePath)
	var recovery *services.RecoveryInfo
	if storageErr != nil {
		slog.Error("open local storage", "error", storageErr, "path", databasePath)
		recovery = &services.RecoveryInfo{
			Message:      storageErr.Error(),
			DatabasePath: databasePath,
			LogPath:      logPath,
		}
	}
	fileDialogs := &wailsFileDialogs{}

	app := application.New(application.Options{
		Name:        "Work Tools",
		Description: "Local-first developer utilities for macOS",
		Services: []application.Service{
			application.NewService(services.NewPayloadService(store)),
			application.NewService(services.NewWorkspaceService(store, recovery)),
			application.NewService(services.NewFileService(fileDialogs)),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})
	fileDialogs.setManager(app.Dialog)
	if store != nil {
		app.OnShutdown(func() {
			if err := store.Close(); err != nil {
				slog.Error("close local storage", "error", err)
			}
		})
	}

	app.Window.NewWithOptions(mainWindowOptions())

	return app.Run()
}

func mainWindowOptions() application.WebviewWindowOptions {
	return application.WebviewWindowOptions{
		Name:      "main",
		Title:     "Work Tools",
		Width:     1280,
		Height:    800,
		MinWidth:  760,
		MinHeight: 520,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 42,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHidden,
			TabbingMode:             application.MacWindowTabbingModeDisallowed,
		},
		BackgroundColour: application.NewRGB(237, 241, 244),
		URL:              "/",
	}
}

func configureLogging() (string, func()) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", func() {}
	}
	logPath := filepath.Join(home, "Library", "Logs", "Work Tools", "work-tools.log")
	if err := os.MkdirAll(filepath.Dir(logPath), 0o700); err != nil {
		return logPath, func() {}
	}
	file, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return logPath, func() {}
	}
	slog.SetDefault(slog.New(slog.NewTextHandler(io.MultiWriter(os.Stderr, file), nil)))
	return logPath, func() {
		if err := file.Close(); err != nil {
			_, _ = fmt.Fprintf(os.Stderr, "close log file: %v\n", err)
		}
	}
}
