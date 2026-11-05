package services

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type FileDialogs interface {
	OpenBase64TextFile() (string, error)
	SaveDecodedPDF(defaultName string) (string, error)
	SaveDiagram(defaultName string, format string) (string, error)
}

// diagramFormat describes one exportable diagram image format.
type diagramFormat struct {
	extension   string
	displayName string
	pattern     string
	isValid     func([]byte) bool
}

var diagramFormats = map[string]diagramFormat{
	"png": {
		extension:   ".png",
		displayName: "PNG images",
		pattern:     "*.png",
		isValid:     func(data []byte) bool { return bytes.HasPrefix(data, []byte("\x89PNG\r\n\x1a\n")) },
	},
	"jpg": {
		extension:   ".jpg",
		displayName: "JPEG images",
		pattern:     "*.jpg;*.jpeg",
		isValid:     func(data []byte) bool { return bytes.HasPrefix(data, []byte{0xFF, 0xD8, 0xFF}) },
	},
	"svg": {
		extension:   ".svg",
		displayName: "SVG images",
		pattern:     "*.svg",
		isValid:     func(data []byte) bool { return bytes.Contains(data, []byte("<svg")) },
	},
}

// DiagramFileFilter exposes the native save dialog filter for a diagram
// format so the Wails dialog layer does not duplicate the format table.
func DiagramFileFilter(format string) (displayName string, pattern string, ok bool) {
	spec, ok := diagramFormats[strings.ToLower(strings.TrimSpace(format))]
	if !ok {
		return "", "", false
	}
	return spec.displayName, spec.pattern, true
}

type OpenTextResult struct {
	Cancelled bool   `json:"cancelled"`
	Name      string `json:"name,omitempty"`
	Text      string `json:"text,omitempty"`
}

type SaveResult struct {
	Cancelled bool   `json:"cancelled"`
	Path      string `json:"path,omitempty"`
}

type FileService struct {
	dialogs FileDialogs
}

func NewFileService(dialogs FileDialogs) *FileService {
	return &FileService{dialogs: dialogs}
}

func (s *FileService) OpenBase64TextFile() (OpenTextResult, error) {
	path, err := s.dialogs.OpenBase64TextFile()
	if err != nil {
		return OpenTextResult{}, fmt.Errorf("choose Base64 text file: %w", err)
	}
	if path == "" {
		return OpenTextResult{Cancelled: true}, nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return OpenTextResult{}, fmt.Errorf("read Base64 text file: %w", err)
	}
	return OpenTextResult{
		Name: filepath.Base(path),
		Text: strings.ToValidUTF8(string(data), "�"),
	}, nil
}

func (s *FileService) SaveDecodedPDF(defaultName string, data []byte) (SaveResult, error) {
	if len(data) < 4 || !bytes.Equal(data[:4], []byte("%PDF")) {
		return SaveResult{}, errors.New("decoded data is not a PDF file")
	}
	name := filepath.Base(defaultName)
	if name == "." || name == "" {
		name = "decoded.pdf"
	}
	if !strings.EqualFold(filepath.Ext(name), ".pdf") {
		name += ".pdf"
	}
	path, err := s.dialogs.SaveDecodedPDF(name)
	if err != nil {
		return SaveResult{}, fmt.Errorf("choose PDF destination: %w", err)
	}
	if path == "" {
		return SaveResult{Cancelled: true}, nil
	}
	if !strings.EqualFold(filepath.Ext(path), ".pdf") {
		path += ".pdf"
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return SaveResult{}, fmt.Errorf("save decoded PDF: %w", err)
	}
	return SaveResult{Path: path}, nil
}

func (s *FileService) SaveDiagram(defaultName string, format string, data []byte) (SaveResult, error) {
	key := strings.ToLower(strings.TrimSpace(format))
	spec, ok := diagramFormats[key]
	if !ok {
		return SaveResult{}, fmt.Errorf("unsupported diagram format %q", format)
	}
	if !spec.isValid(data) {
		return SaveResult{}, fmt.Errorf("exported data is not a %s file", strings.ToUpper(key))
	}
	name := filepath.Base(defaultName)
	if name == "." || name == string(filepath.Separator) || name == "" {
		name = "diagram"
	}
	if !strings.EqualFold(filepath.Ext(name), spec.extension) {
		name = strings.TrimSuffix(name, filepath.Ext(name)) + spec.extension
	}
	path, err := s.dialogs.SaveDiagram(name, key)
	if err != nil {
		return SaveResult{}, fmt.Errorf("choose diagram destination: %w", err)
	}
	if path == "" {
		return SaveResult{Cancelled: true}, nil
	}
	if !strings.EqualFold(filepath.Ext(path), spec.extension) {
		path += spec.extension
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return SaveResult{}, fmt.Errorf("save exported diagram: %w", err)
	}
	return SaveResult{Path: path}, nil
}
